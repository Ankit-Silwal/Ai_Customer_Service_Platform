import { z } from "zod";

export const deliveryRoleSchema = z.enum(["admin", "worker", "customer"]);
export const deliveryStatusSchema = z.enum([
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const refundReasonSchema = z.enum([
  "missing",
  "damaged",
  "late",
  "cancelled",
  "other",
]);
export const deliveryOrderSchema = z.object({
  requestId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(40),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(10),
  address: z.string().trim().min(10).max(300),
  instructions: z.string().trim().max(300).default(""),
});
export const refundRequestSchema = z.object({
  reason: refundReasonSchema,
  details: z.string().trim().min(10).max(1000),
});
export const refundDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().min(5).max(500),
});
export const deliveryMemberSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(["worker", "customer"]),
});
export const deliverySignupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const deliveryCatalog = [
  {
    id: "green-bowl",
    name: "The green goddess",
    description: "Avocado, grains, crispy chickpeas & tahini",
    category: "Bowls",
    price: 1450,
    art: "bowl",
    tag: "Plant powered",
  },
  {
    id: "burrata",
    name: "Burrata & sunshine",
    description: "Creamy burrata, heirloom tomatoes & basil",
    category: "Seasonal",
    price: 1650,
    art: "salad",
    tag: "Chef's pick",
  },
  {
    id: "sando",
    name: "The golden sando",
    description: "Crispy chicken, slaw & our house sauce",
    category: "Comfort",
    price: 1350,
    art: "sandwich",
    tag: "A little indulgence",
  },
  {
    id: "salmon",
    name: "Miso happy bowl",
    description: "Miso salmon, sesame rice & crunchy greens",
    category: "Bowls",
    price: 1850,
    art: "salmon",
    tag: "Most loved",
  },
  {
    id: "matcha",
    name: "Cloud nine matcha",
    description: "Ceremonial matcha with oat milk over ice",
    category: "Drinks",
    price: 650,
    art: "drink",
    tag: "Sip something good",
  },
  {
    id: "cookie",
    name: "The warm little extra",
    description: "Brown butter chocolate chunk cookie",
    category: "Treats",
    price: 450,
    art: "cookie",
    tag: "Freshly baked",
  },
] as const;
export type DeliveryRole = z.infer<typeof deliveryRoleSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type RefundReason = z.infer<typeof refundReasonSchema>;
export type DeliveryOrder = {
  id: string;
  number: number;
  customer_id: string;
  customer_name: string;
  worker_id: string | null;
  status: DeliveryStatus;
  items: { name: string; quantity: number; price: number; art: string }[];
  total_cents: number;
  delivery_cents: number;
  address: string;
  instructions: string;
  created_at: string;
  promised_at: string;
  delivered_at: string | null;
  conversation_id: string | null;
  refund: DeliveryRefund | null;
};
export type DeliveryRefund = {
  id: string;
  reason: RefundReason;
  details: string;
  assessment: "eligible" | "ineligible" | "review";
  explanation: string;
  amount_cents: number;
  status: "pending" | "approved" | "rejected";
  ai_content: string;
  ai_mode: "ai" | "preview" | "fallback";
  citations: import("./index.ts").Citation[];
  decision_note: string | null;
  created_at: string;
};
export type DeliveryStore = {
  id: string;
  name: string;
  organization_id: string;
  bot_id: string;
  public_id: string;
  policy_status: string | null;
};
export type DeliverySession = {
  user: { id: string; name: string; email: string };
  role: DeliveryRole;
  aiEnabled: boolean;
};
