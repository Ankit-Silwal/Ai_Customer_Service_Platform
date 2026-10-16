import type { RefundReason, DeliveryStatus } from "@relay/contracts";

export const POLICY_VERSION = "2026-10-17";
export type RefundFacts = {
  status: DeliveryStatus;
  total_cents: number;
  delivery_cents: number;
  created_at: Date;
  delivered_at: Date | null;
  promised_at: Date;
};
export function assessRefund(
  order: RefundFacts,
  reason: RefundReason,
  now = new Date(),
) {
  const result = (
    assessment: "eligible" | "ineligible" | "review",
    amount: number,
    explanation: string,
  ) => ({ assessment, amount_cents: amount, explanation });
  if (order.status === "cancelled")
    return result(
      "eligible",
      order.total_cents,
      "Rule R1: A cancelled order qualifies for a full refund of the amount paid.",
    );
  if (order.status !== "delivered")
    return result(
      "review",
      0,
      "Rule R5: This order is still active. A teammate must check fulfilment before approving a refund.",
    );
  if (!order.delivered_at || order.delivered_at > now)
    return result(
      "review",
      0,
      "Rule R5: Delivery time needs verification by a teammate.",
    );
  if (now.getTime() - order.delivered_at.getTime() > 24 * 3600_000)
    return result(
      "ineligible",
      0,
      "Rule R4: This request is outside the 24-hour reporting window. You can ask a teammate to review an exception.",
    );
  if (reason === "missing" || reason === "damaged")
    return result(
      "review",
      order.total_cents,
      "Rule R2: Missing or damaged items reported within 24 hours require human verification. The full order value is the maximum refund; no automatic approval is made.",
    );
  if (reason === "late") {
    if (
      order.delivered_at.getTime() - order.promised_at.getTime() >=
      30 * 60_000
    )
      return result(
        "eligible",
        order.delivery_cents,
        "Rule R3: Delivery was at least 30 minutes beyond the promised time. The delivery fee qualifies for a refund.",
      );
    return result(
      "ineligible",
      0,
      "Rule R3: Recorded delivery was less than 30 minutes late, so the delivery-fee refund threshold is not met.",
    );
  }
  return result(
    "review",
    0,
    "Rule R5: This concern needs a teammate's review. Explain what happened in the support chat.",
  );
}
