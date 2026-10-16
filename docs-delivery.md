# Parcel & Plate delivery demo

The delivery example uses Relay's existing API, knowledge service, background worker, and customer/agent conversation system. It adds a tenant-scoped delivery domain rather than duplicating authentication or chat.

## Policy foundation

Migration `002_delivery` adds organization-owned stores, delivery memberships (admin, worker, customer), orders and one refund request per order. Composite foreign keys enforce organization consistency. Prices are integer USD cents. Refunds are simulated ledger decisions, not payments.

`packages/server/src/refund-policy.ts` owns version 2026-10-17 of the executable rules. Cancelled orders are eligible for the amount paid; delivery at least 30 minutes late is eligible for the delivery fee when reported within 24 hours. Missing/damaged items require verification. Other, active, and disputed cases go to human review. AI must never override these bounds or execute financial actions.

The policy PDF is `packages/server/assets/parcel-plate-refund-policy.pdf`. Regenerate with `python scripts/generate-delivery-policy.py` after installing `reportlab==4.4.3` and `pymupdf`. The script also checks extracted rule labels and renders a PNG into ignored `.platform-logs/pdf-preview` for visual QA. Keep PDF wording, executable rules and boundary tests in sync when changing policy.

Migrations run through the existing `platform:up` startup or `node --env-file=.env.platform --import tsx packages/server/src/migrate.ts`. The migration ledger and advisory lock make repeat runs safe.
