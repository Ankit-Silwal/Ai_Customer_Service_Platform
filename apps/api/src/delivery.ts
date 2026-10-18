import { Router, type Response } from "express";
import { z } from "zod";
import { pool, transaction, audit } from "@relay/server/db";
import { config } from "@relay/server/config";
import { HttpError } from "@relay/server/http";
import { hash, token, passwordHash, signScope } from "@relay/server/security";
import { readDeliveryPolicy } from "@relay/server/delivery-policy";
import {
  assessRefund,
  POLICY_VERSION,
  type RefundFacts,
} from "@relay/server/refund-policy";
import {
  deliveryCatalog,
  deliveryOrderSchema,
  deliveryStatusSchema,
  deliverySignupSchema,
  deliveryMemberSchema,
  refundRequestSchema,
  refundDecisionSchema,
  answerSchema,
  type DeliveryRole,
  type DeliveryStatus,
} from "@relay/contracts";
import {
  authenticated,
  principal,
  membership,
  cookieOptions,
  rateLimit,
} from "./auth.ts";

export const delivery = Router();
type Store = {
  id: string;
  organization_id: string;
  bot_id: string;
  name: string;
  public_id: string;
};
async function storeFor(id: unknown): Promise<Store> {
  const r = await pool.query(
    "SELECT s.*,b.public_id FROM delivery_stores s JOIN organizations o ON o.id=s.organization_id JOIN bots b ON b.id=s.bot_id WHERE s.id=$1 AND NOT o.suspended",
    [z.uuid().parse(id)],
  );
  if (!r.rows[0]) throw new HttpError(404, "Delivery workspace not found.");
  return r.rows[0] as Store;
}
async function roleFor(
  store: Store,
  res: Response,
  allowed: DeliveryRole[] = ["admin", "worker", "customer"],
) {
  const r = await pool.query(
    "SELECT role FROM delivery_members WHERE store_id=$1 AND organization_id=$2 AND user_id=$3",
    [store.id, store.organization_id, principal(res).id],
  );
  const role = r.rows[0]?.role as DeliveryRole | undefined;
  if (!role || !allowed.includes(role))
    throw new HttpError(403, "You do not have access to this delivery action.");
  // Delivery admins must still hold an active Relay owner/admin membership.
  if (role === "admin")
    await membership(res, store.organization_id, ["OWNER", "ADMIN"]);
  return role;
}
async function knowledge(store: Store, path: string, body: unknown) {
  const r = await fetch(config.KNOWLEDGE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-scope": signScope(
        { organizationId: store.organization_id, botId: store.bot_id },
        config.INTERNAL_SECRET,
      ),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(100_000),
  });
  if (!r.ok)
    throw new HttpError(
      502,
      "Knowledge processing is unavailable. Please retry.",
    );
  return r.json() as Promise<unknown>;
}
delivery.get("/policy.pdf", async (_req, res) => {
  res
    .type("application/pdf")
    .set(
      "Content-Disposition",
      'inline; filename="parcel-plate-refund-policy.pdf"',
    )
    .send(await readDeliveryPolicy());
});
delivery.get("/stores/:storeId", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  const docs = await pool.query(
    "SELECT status FROM documents WHERE bot_id=$1 AND name='Parcel & Plate refund policy.pdf' ORDER BY created_at DESC LIMIT 1",
    [store.bot_id],
  );
  res.json({
    ...store,
    policy_status: docs.rows[0]?.status ?? null,
    catalog: deliveryCatalog,
  });
});
delivery.post("/stores/:storeId/register", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    input = deliverySignupSchema.parse(req.body);
  await rateLimit("delivery-register:" + hash(req.ip ?? "unknown"), 10, 3600);
  const password = await passwordHash(input.password),
    session = token();
  try {
    await transaction(async (c) => {
      const user = (
        await c.query(
          "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
          [input.name, input.email, password],
        )
      ).rows[0] as { id: string };
      await c.query(
        "INSERT INTO delivery_members VALUES($1,$2,$3,'customer')",
        [store.id, store.organization_id, user.id],
      );
      await c.query(
        "INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",
        [hash(session), user.id],
      );
      await audit(
        store.organization_id,
        user.id,
        "delivery.customer_registered",
        user.id,
        c,
      );
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new HttpError(409, "An account already exists. Sign in instead.");
    throw e;
  }
  res
    .cookie("relay_session", session, cookieOptions)
    .status(201)
    .json({ ok: true });
});
delivery.use(authenticated);
delivery.post("/setup", async (req, res) => {
  const { organizationId } = z
    .object({ organizationId: z.uuid() })
    .parse(req.body);
  await membership(res, organizationId, ["OWNER", "ADMIN"]);
  const result = await transaction(async (c) => {
    await c.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      organizationId,
    ]);
    let store = (
      await c.query("SELECT * FROM delivery_stores WHERE organization_id=$1", [
        organizationId,
      ])
    ).rows[0] as Store | undefined;
    if (!store) {
      const bot = (
        await c.query(
          "INSERT INTO bots(organization_id,name,greeting,color,published) VALUES($1,'Parcel & Plate concierge','Hello! I can help with delivery, refund rules, or connect you with our team.','#244c38',true) RETURNING id",
          [organizationId],
        )
      ).rows[0] as { id: string };
      store = (
        await c.query(
          "INSERT INTO delivery_stores(organization_id,bot_id) VALUES($1,$2) RETURNING *",
          [organizationId, bot.id],
        )
      ).rows[0] as Store;
      await audit(
        organizationId,
        principal(res).id,
        "delivery.store_created",
        store.id,
        c,
      );
    }
    await c.query(
      "INSERT INTO delivery_members VALUES($1,$2,$3,'admin') ON CONFLICT(store_id,user_id) DO UPDATE SET role='admin'",
      [store.id, organizationId, principal(res).id],
    );
    return store;
  });
  res.json(result);
});
delivery.post("/stores/:storeId/policy", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await roleFor(store, res, ["admin"]);
  const result = await knowledge(store, "/documents", {
    name: "Parcel & Plate refund policy.pdf",
    type: "application/pdf",
    content: (await readDeliveryPolicy()).toString("base64"),
  });
  const uploaded = z.object({ id: z.uuid() }).parse(result);
  const status = await pool.query(
    "SELECT status FROM documents WHERE id=$1 AND organization_id=$2",
    [uploaded.id, store.organization_id],
  );
  if (status.rows[0]?.status === "failed")
    await knowledge(store, `/documents/${uploaded.id}/retry`, {});
  res.json(uploaded);
});
delivery.get("/stores/:storeId/me", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    role = await roleFor(store, res);
  res.json({
    user: principal(res),
    role,
    aiEnabled: Boolean(config.AI_API_KEY),
  });
});
delivery.post("/stores/:storeId/join", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO delivery_members VALUES($1,$2,$3,'customer') ON CONFLICT DO NOTHING",
      [store.id, store.organization_id, principal(res).id],
    );
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.customer_joined",
      store.id,
      c,
    );
  });
  res.json({ ok: true });
});
delivery.get("/stores/:storeId/members", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await roleFor(store, res, ["admin"]);
  res.json(
    (
      await pool.query(
        "SELECT u.id,u.name,u.email,m.role FROM delivery_members m JOIN users u ON u.id=m.user_id WHERE m.store_id=$1 ORDER BY u.name",
        [store.id],
      )
    ).rows,
  );
});
delivery.post("/stores/:storeId/members", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await roleFor(store, res, ["admin"]);
  const input = deliveryMemberSchema.parse(req.body);
  await transaction(async (c) => {
    const member = (
      await c.query(
        "SELECT m.user_id,m.role FROM delivery_members m JOIN users u ON u.id=m.user_id WHERE m.store_id=$1 AND u.email=$2 AND NOT u.suspended FOR UPDATE OF m",
        [store.id, input.email],
      )
    ).rows[0] as { user_id: string; role: string } | undefined;
    if (!member)
      throw new HttpError(
        404,
        "Ask this person to register in your delivery store first.",
      );
    if (member.role === "admin")
      throw new HttpError(409, "Admin access is managed through Relay.");
    if (input.role === "customer") {
      const active = await c.query(
        "SELECT id FROM delivery_orders WHERE store_id=$1 AND worker_id=$2 AND status NOT IN ('delivered','cancelled')",
        [store.id, member.user_id],
      );
      if (active.rowCount)
        throw new HttpError(
          409,
          "Complete assigned deliveries before removing worker access.",
        );
    }
    await c.query(
      "UPDATE delivery_members SET role=$3 WHERE store_id=$1 AND user_id=$2",
      [store.id, member.user_id, input.role],
    );
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.role_" + input.role,
      member.user_id,
      c,
    );
  });
  res.json({ ok: true });
});
delivery.get("/stores/:storeId/orders", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    role = await roleFor(store, res);
  const result = await pool.query(
    `SELECT o.*,o.number::int,u.name AS customer_name,CASE WHEN $3='worker' THEN NULL ELSE to_jsonb(r) END AS refund FROM delivery_orders o JOIN users u ON u.id=o.customer_id LEFT JOIN delivery_refunds r ON r.order_id=o.id WHERE o.store_id=$1 AND o.organization_id=$2 AND ($3='admin' OR ($3='customer' AND o.customer_id=$4) OR ($3='worker' AND o.status NOT IN ('cancelled') AND ((o.worker_id IS NULL AND o.status NOT IN ('delivered','cancelled')) OR o.worker_id=$4))) ORDER BY o.created_at DESC LIMIT 100`,
    [store.id, store.organization_id, role, principal(res).id],
  );
  res.json(
    result.rows.map((row) =>
      role === "worker" ? { ...row, conversation_id: null } : row,
    ),
  );
});
delivery.post("/stores/:storeId/orders", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await roleFor(store, res, ["customer", "admin"]);
  const input = deliveryOrderSchema.parse(req.body);
  await rateLimit("delivery-order:" + principal(res).id, 15, 3600);
  const items = input.items.map((i) => {
    const product = deliveryCatalog.find((p) => p.id === i.productId);
    if (!product) throw new HttpError(400, "That menu item is unavailable.");
    return {
      name: product.name,
      quantity: i.quantity,
      price: product.price,
      art: product.art,
    };
  });
  const total = 350 + items.reduce((n, i) => n + i.price * i.quantity, 0);
  const result = await transaction(async (c) => {
    const row = (
      await c.query(
        "INSERT INTO delivery_orders(store_id,organization_id,customer_id,request_id,items,total_cents,delivery_cents,address,instructions) VALUES($1,$2,$3,$4,$5,$6,350,$7,$8) ON CONFLICT(customer_id,store_id,request_id) DO NOTHING RETURNING id",
        [
          store.id,
          store.organization_id,
          principal(res).id,
          input.requestId,
          JSON.stringify(items),
          total,
          input.address,
          input.instructions,
        ],
      )
    ).rows[0] as { id: string } | undefined;
    if (row) {
      await audit(
        store.organization_id,
        principal(res).id,
        "delivery.order_placed",
        row.id,
        c,
      );
      return row;
    }
    return (
      await c.query(
        "SELECT id FROM delivery_orders WHERE store_id=$1 AND customer_id=$2 AND request_id=$3",
        [store.id, principal(res).id, input.requestId],
      )
    ).rows[0];
  });
  res.status(201).json(result);
});
delivery.post("/stores/:storeId/samples", async (req, res) => {
  const store = await storeFor(req.params.storeId);
  await roleFor(store, res, ["admin"]);
  await transaction(async (c) => {
    await c.query("SELECT id FROM delivery_stores WHERE id=$1 FOR UPDATE", [
      store.id,
    ]);
    for (const [index, status] of (
      ["delivered", "preparing", "cancelled"] as const
    ).entries()) {
      const product = deliveryCatalog[index]!;
      await c.query(
        `INSERT INTO delivery_orders(store_id,organization_id,customer_id,request_id,items,total_cents,delivery_cents,address,status,created_at,promised_at,delivered_at) VALUES($1,$2,$3,$4,$5,$6,350,'42 Garden Lane, Demo District',$7,now()-interval '2 hours',now()-interval '80 minutes',CASE WHEN $7='delivered' THEN now()-interval '30 minutes' ELSE NULL END) ON CONFLICT(customer_id,store_id,request_id) DO NOTHING`,
        [
          store.id,
          store.organization_id,
          principal(res).id,
          `00000000-0000-4000-8000-00000000000${index}`,
          JSON.stringify([
            {
              name: product.name,
              price: product.price,
              quantity: 1,
              art: product.art,
            },
          ]),
          product.price + 350,
          status,
        ],
      );
    }
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.samples_created",
      store.id,
      c,
    );
  });
  res.json({ ok: true });
});
type OrderRow = RefundFacts & {
  id: string;
  organization_id: string;
  store_id: string;
  customer_id: string;
  worker_id: string | null;
  conversation_id: string | null;
  number: string;
  items: unknown;
  status: DeliveryStatus;
};
async function ownedOrder(store: Store, id: unknown, res: Response) {
  await roleFor(store, res, ["admin", "customer"]);
  const order = (
    await pool.query(
      "SELECT * FROM delivery_orders WHERE id=$1 AND store_id=$2 AND organization_id=$3 AND customer_id=$4",
      [z.uuid().parse(id), store.id, store.organization_id, principal(res).id],
    )
  ).rows[0] as OrderRow | undefined;
  if (!order) throw new HttpError(404, "Order not found.");
  return order;
}
delivery.post("/stores/:storeId/orders/:orderId/status", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    role = await roleFor(store, res, ["admin", "worker"]);
  const input = z.object({ status: deliveryStatusSchema }).parse(req.body),
    id = z.uuid().parse(req.params.orderId);
  await transaction(async (c) => {
    // Lock membership before assignment so worker demotion and claims cannot race.
    await c.query(
      "SELECT role FROM delivery_members WHERE store_id=$1 AND user_id=$2 FOR UPDATE",
      [store.id, principal(res).id],
    );
    await roleFor(store, res, ["admin", "worker"]);
    const order = (
      await c.query(
        "SELECT * FROM delivery_orders WHERE id=$1 AND store_id=$2 FOR UPDATE",
        [id, store.id],
      )
    ).rows[0] as OrderRow | undefined;
    if (!order) throw new HttpError(404, "Order not found.");
    if (
      role === "worker" &&
      order.worker_id &&
      order.worker_id !== principal(res).id
    )
      throw new HttpError(403, "This delivery is assigned to another worker.");
    if (order.status === input.status) return;
    const next: Record<DeliveryStatus, DeliveryStatus[]> = {
      placed: ["preparing", "cancelled"],
      preparing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    if (!next[order.status].includes(input.status))
      throw new HttpError(
        409,
        "This order has changed or that transition is not allowed.",
      );
    if (input.status === "cancelled" && role !== "admin")
      throw new HttpError(403, "Only an administrator can cancel an order.");
    await c.query(
      "UPDATE delivery_orders SET status=$2,worker_id=CASE WHEN $3='worker' THEN $4 ELSE worker_id END,delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END WHERE id=$1",
      [id, input.status, role, principal(res).id],
    );
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.order_" + input.status,
      id,
      c,
    );
  });
  res.json({ ok: true });
});
delivery.post("/stores/:storeId/orders/:orderId/support", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    order = await ownedOrder(store, req.params.orderId, res),
    visitor = token();
  const chat = await transaction(async (c) => {
    const current = (
      await c.query(
        "SELECT conversation_id FROM delivery_orders WHERE id=$1 FOR UPDATE",
        [order.id],
      )
    ).rows[0] as { conversation_id: string | null };
    if (current.conversation_id) {
      const found = await c.query(
        "UPDATE conversations SET visitor_hash=$2 WHERE id=$1 AND mode<>'resolved' RETURNING id",
        [current.conversation_id, hash(visitor)],
      );
      if (found.rows[0]) return found.rows[0] as { id: string };
    }
    const row = (
      await c.query(
        "INSERT INTO conversations(organization_id,bot_id,visitor_hash,title) VALUES($1,$2,$3,$4) RETURNING id",
        [
          store.organization_id,
          store.bot_id,
          hash(visitor),
          "Order #" + order.number + " · " + principal(res).name,
        ],
      )
    ).rows[0] as { id: string };
    await c.query(
      "INSERT INTO messages(conversation_id,organization_id,role,content) VALUES($1,$2,'system',$3)",
      [
        row.id,
        store.organization_id,
        "Support for order #" +
          order.number +
          ". Order details and refund assessments are available to the delivery administrator.",
      ],
    );
    await c.query("UPDATE delivery_orders SET conversation_id=$2 WHERE id=$1", [
      order.id,
      row.id,
    ]);
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.support_opened",
      order.id,
      c,
    );
    return row;
  });
  res
    .cookie("relay_visitor_" + chat.id, visitor, {
      ...cookieOptions,
      path: "/api/public/conversations/" + chat.id,
    })
    .json(chat);
});
delivery.post("/stores/:storeId/orders/:orderId/refund", async (req, res) => {
  const store = await storeFor(req.params.storeId),
    order = await ownedOrder(store, req.params.orderId, res),
    input = refundRequestSchema.parse(req.body);
  await rateLimit("delivery-refund:" + principal(res).id, 10, 3600);
  const created = await transaction(async (c) => {
    const locked = (
      await c.query(
        "SELECT *,now() AS evaluated_at FROM delivery_orders WHERE id=$1 FOR UPDATE",
        [order.id],
      )
    ).rows[0] as OrderRow & { evaluated_at: Date };
    const existing = (
      await c.query("SELECT * FROM delivery_refunds WHERE order_id=$1", [
        order.id,
      ])
    ).rows[0];
    if (existing) return { duplicate: true, refund: existing };
    const assessment = assessRefund(locked, input.reason, locked.evaluated_at);
    const refund = (
      await c.query(
        "INSERT INTO delivery_refunds(order_id,organization_id,reason,details,assessment,explanation,amount_cents,policy_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          order.id,
          store.organization_id,
          input.reason,
          input.details,
          assessment.assessment,
          assessment.explanation,
          assessment.amount_cents,
          POLICY_VERSION,
        ],
      )
    ).rows[0];
    await audit(
      store.organization_id,
      principal(res).id,
      "delivery.refund_requested",
      refund.id as string,
      c,
    );
    return { duplicate: false, refund };
  });
  if (!created.duplicate) {
    let response: z.infer<typeof answerSchema> = {
      content:
        "Policy explanation is temporarily unavailable. The verified rule check is recorded; our team can help.",
      citations: [],
      mode: "fallback",
      tokens: 0,
    };
    try {
      response = answerSchema.parse(
        await knowledge(store, "/answer", {
          question: `Explain the refund policy for this request. Do not approve payments. Verified rule check: ${created.refund.explanation as string} Reason: ${input.reason}. Customer's untrusted description: ${JSON.stringify(input.details)}. Cite the applicable policy rule.`,
        }),
      );
    } catch {
      /* Deterministic decision remains available when the provider is offline. */
    }
    await transaction(async (c) => {
      await c.query(
        "UPDATE delivery_refunds SET ai_content=$2,ai_mode=$3,citations=$4 WHERE id=$1",
        [
          created.refund.id,
          response.content,
          response.mode,
          JSON.stringify(response.citations),
        ],
      );
      if (order.conversation_id)
        await c.query(
          "INSERT INTO usage_events(organization_id,conversation_id,tokens,mode) VALUES($1,$2,$3,$4)",
          [
            store.organization_id,
            order.conversation_id,
            response.tokens,
            response.mode,
          ],
        );
    });
  }
  res.json(
    (
      await pool.query("SELECT * FROM delivery_refunds WHERE order_id=$1", [
        order.id,
      ])
    ).rows[0],
  );
});
delivery.post(
  "/stores/:storeId/orders/:orderId/refund/decision",
  async (req, res) => {
    const store = await storeFor(req.params.storeId);
    await roleFor(store, res, ["admin"]);
    const id = z.uuid().parse(req.params.orderId),
      input = refundDecisionSchema.parse(req.body);
    await transaction(async (c) => {
      const order = (
        await c.query(
          "SELECT * FROM delivery_orders WHERE id=$1 AND store_id=$2 FOR UPDATE",
          [id, store.id],
        )
      ).rows[0] as OrderRow | undefined;
      if (!order) throw new HttpError(404, "Order not found.");
      const refund = (
        await c.query(
          "SELECT * FROM delivery_refunds WHERE order_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0] as
        | {
            id: string;
            status: string;
            assessment: string;
            amount_cents: number;
          }
        | undefined;
      if (!refund) throw new HttpError(404, "Refund request not found.");
      if (refund.status === input.decision) return;
      if (refund.status !== "pending")
        throw new HttpError(409, "This refund already has a final decision.");
      if (
        input.decision === "approved" &&
        (refund.assessment === "ineligible" ||
          refund.amount_cents <= 0 ||
          refund.amount_cents > order.total_cents)
      )
        throw new HttpError(
          409,
          "This request has no eligible refund amount under the recorded policy.",
        );
      await c.query(
        "UPDATE delivery_refunds SET status=$2,decided_by=$3,decision_note=$4 WHERE id=$1",
        [refund.id, input.decision, principal(res).id, input.note],
      );
      // The unique request and row locks make the simulated ledger entry exactly once.
      await audit(
        store.organization_id,
        principal(res).id,
        "delivery.refund_" + input.decision,
        refund.id,
        c,
      );
    });
    res.json({ ok: true });
  },
);
