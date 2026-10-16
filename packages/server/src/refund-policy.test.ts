import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRefund, type RefundFacts } from "./refund-policy.ts";
const now = new Date("2026-10-17T12:00:00Z");
const order: RefundFacts = {
  status: "delivered",
  total_cents: 3400,
  delivery_cents: 350,
  created_at: new Date("2026-10-17T09:00:00Z"),
  promised_at: new Date("2026-10-17T10:00:00Z"),
  delivered_at: new Date("2026-10-17T10:30:00Z"),
};
test("late refund uses verified timing and is capped to the delivery fee", () => {
  assert.deepEqual(assessRefund(order, "late", now).amount_cents, 350);
  assert.equal(
    assessRefund(
      { ...order, delivered_at: new Date("2026-10-17T10:29:59Z") },
      "late",
      now,
    ).assessment,
    "ineligible",
  );
});
test("24-hour boundary, missing evidence, active and cancelled orders", () => {
  assert.equal(assessRefund(order, "missing", now).assessment, "review");
  assert.equal(
    assessRefund(order, "damaged", new Date("2026-10-18T10:30:00Z")).assessment,
    "review",
  );
  assert.equal(
    assessRefund(order, "damaged", new Date("2026-10-18T10:30:01Z")).assessment,
    "ineligible",
  );
  assert.equal(
    assessRefund({ ...order, status: "preparing" }, "late", now).amount_cents,
    0,
  );
  assert.equal(
    assessRefund({ ...order, status: "cancelled" }, "cancelled", now)
      .amount_cents,
    order.total_cents,
  );
  assert.equal(
    assessRefund({ ...order, delivered_at: null }, "late", now).assessment,
    "review",
  );
});
