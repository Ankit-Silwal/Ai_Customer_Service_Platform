# Parcel & Plate delivery demo

The delivery example uses Relay's existing API, knowledge service, background worker, and customer/agent conversation system. It adds a tenant-scoped delivery domain rather than duplicating authentication or chat.

## Policy foundation

Migration `002_delivery` adds organization-owned stores, delivery memberships (admin, worker, customer), orders and one refund request per order. Composite foreign keys enforce organization consistency. Prices are integer USD cents. Refunds are simulated ledger decisions, not payments.

`packages/server/src/refund-policy.ts` owns version 2026-10-17 of the executable rules. Cancelled orders are eligible for the amount paid; delivery at least 30 minutes late is eligible for the delivery fee when reported within 24 hours. Missing/damaged items require verification. Other, active, and disputed cases go to human review. AI must never override these bounds or execute financial actions.

The policy PDF is `packages/server/assets/parcel-plate-refund-policy.pdf`. Regenerate with `python scripts/generate-delivery-policy.py` after installing `reportlab==4.4.3` and `pymupdf`. The script also checks extracted rule labels and renders a PNG into ignored `.platform-logs/pdf-preview` for visual QA. Keep PDF wording, executable rules and boundary tests in sync when changing policy.

Migrations run through the existing `platform:up` startup or `node --env-file=.env.platform --import tsx packages/server/src/migrate.ts`. The migration ledger and advisory lock make repeat runs safe.

## Delivery API milestone

All paths start with `/api/delivery`. `GET /policy.pdf` serves the versioned demo PDF; `GET /stores/:storeId` returns public store metadata. `POST /stores/:storeId/register` creates a customer account with the normal hashed, expiring Relay session cookie. Existing users sign in normally and `POST /stores/:storeId/join`. Request bodies cannot select a privileged role.

A Relay owner/admin calls `POST /setup` with `organizationId` to create one store and dedicated bot. `POST /stores/:storeId/policy` submits the PDF through the signed knowledge-service API; failed ingestion can be retried with the same endpoint. `POST /samples` creates three clearly simulated scenarios idempotently.

Within `/stores/:storeId`: `GET /me`, `GET /orders`, `POST /orders`, `GET /members`, and `POST /members` power the role-specific views. Order creation accepts a UUID requestId, product IDs, quantities, address and instructions. Prices and the $3.50 delivery fee come from the server catalog, never client totals. All amounts are USD cents.

`POST /orders/:orderId/status` accepts only the next fulfilment state. A worker claims an unassigned order by progressing it and cannot change another worker's assignment. Only an admin can cancel before dispatch. Worker lists omit refunds and conversation identifiers. Customer lists contain only their own orders. A worker cannot be demoted while assigned active deliveries remain.

`POST /orders/:orderId/support` gives the order owner a visitor capability for the same tenant-scoped Relay conversation. Admins join through the existing protected conversation routes; no new chat implementation or weaker takeover path is introduced.

`POST /orders/:orderId/refund` accepts a reason and details. It stores one deterministic assessment, then requests a cited explanation from the knowledge service. Model failure leaves the rule check usable. The UI labels no-key output as a source preview. Untrusted customer text and model output cannot change the eligibility/amount. `POST /orders/:orderId/refund/decision` accepts an admin decision and review note. Locks, unique constraints, bounded amounts, and audit events prevent duplicate simulated payments. The request-time policy and order facts define the recorded assessment. Unknown/active cases with no supported amount cannot be approved through this demo; the team can discuss them in chat.

No new environment variables or dependencies are needed. The existing `AI_API_KEY` enables generated explanations; absent a key, policy retrieval is still demonstrable. Run `node --env-file=.env.platform --import tsx --test apps/api/test/delivery.test.ts` against running services for role, company isolation, server pricing, PDF retrieval, duplicate-decision and takeover checks.

## Try the delivery experience

Open `/delivery` while signed into Relay as an organization owner/admin, launch the workspace, and choose **Prepare demo**. This creates sample orders and sends the real policy PDF to Relay's document queue. Wait for policy ingestion to become Ready. This uses no hard-coded account passwords or public admin impersonation links.

- **Discover / My orders:** search and filter the menu, add items, enter an address, place a simulated paid order, track fulfilment, check refund eligibility, and open order-linked support.
- **Dispatch:** workers claim an available order and move it from preparation to out-for-delivery to delivered. They cannot approve refunds or administer the store.
- **Admin:** review verified eligibility, source excerpts or AI explanations, confirm a simulated refund with a customer-visible note, and join customer conversations.
- **Team:** share the store URL, let a teammate register as a customer, then grant worker access by email. Admin access is bootstrapped only from authenticated Relay owner/admin permissions.

Use separate browser profiles for the customer, worker, and administrator. The same-origin account cookie intentionally represents one identity per browser profile. In a customer order choose **Get support**, ask a policy question, then **Talk to our team**. The admin opens the conversation in Admin and chooses **Join conversation**. The original transcript is retained and AI remains paused.

The React delivery screens live in `apps/web/src/Delivery.tsx`, with local food illustrations and refund/auth components in `DeliveryFoodArt.tsx` and `DeliverySupport.tsx`. Shared accessible dialogs remain in `packages/ui`. All illustrations and fonts work without third-party image/font requests. The desktop and mobile test covers separate customer/worker/admin sessions, ordering, fulfilment, source citations, takeover, refund approval, search, and overflow. Run `npm run test:e2e --workspace @relay/web -- e2e/delivery.spec.ts`.

## Demo limits

The catalog and fee are fixed USD demonstration data; there are no live restaurants, card charges, GPS positions, SMS notifications, or payment-provider refunds. Sample order timestamps are relative to creation. Every refund is an audited simulated decision. AI support requires a server-side provider key; without one the same workflow returns clearly identified source previews. AI output is explanatory, never authoritative for eligibility or payment amounts. Lists currently show the most recent 100 orders and refresh every five seconds; chat uses Relay's existing polling. Production deployment still needs the hardening and operational work described in the platform docs.
