# Relay service architecture

Relay is an npm-workspaces application with independently runnable gateway, knowledge service, and ingestion worker. The web client arrives in the next milestone.

## Run the backend

```sh
npm install
node scripts/setup-platform.mjs
docker compose --env-file .env.platform -f compose.infra.yml up -d
node --env-file=.env.platform --import tsx packages/server/src/migrate.ts
```

Run these in separate terminals from the repository root:

```sh
node --env-file=.env.platform --import tsx apps/api/src/index.ts
node --env-file=.env.platform --import tsx apps/knowledge/src/index.ts
node --env-file=.env.platform --import tsx apps/worker/src/index.ts
```

The gateway listens on 4100; knowledge listens on 4101. Only the gateway should be exposed through the website. The worker polls durable PostgreSQL ingestion jobs using row locks, leases, heartbeats, and up to three attempts. No Redis dependency is needed for this initial durable queue.

## Boundaries

- `apps/api`: accounts, opaque sessions, organizations and roles, bot configuration, public visitor sessions, conversations and human takeover.
- `apps/knowledge`: private document upload/deletion, retrieval, embeddings, generated answers and source citations. Gateway requests carry an expiring HMAC-signed organization/bot scope.
- `apps/worker`: PDF/text extraction, page-preserving chunks and embedding creation.
- `packages/contracts`: shared validated request schemas and frontend DTOs.
- `packages/server`: server-only configuration, database/transactions, hashing, storage and AI adapter.

The first deployment shares a PostgreSQL database and server package. These are process/service boundaries, not independently owned databases. Moving identity and chat to separate databases, independent migration streams and service credentials is future work.

## Knowledge flow

Upload PDF, TXT or Markdown (5 MB maximum; 50 documents per bot). Validate byte signature/UTF-8 before private object storage; persist only metadata and derived passages in PostgreSQL. Queue the document; the worker extracts up to 200 PDF pages and 500 chunks. SHA-256 deduplicates repeat uploads per bot. A lease prevents stale workers from publishing results. Deletion removes the private object and cascades its chunks.

With `AI_API_KEY`, the worker creates 1536-dimensional embeddings; retrieval combines PostgreSQL text search with vector similarity inside the bot/tenant scope. Model output is validated and citations map only to retrieved passages. Documents ingested before enabling embeddings remain searchable lexically; delete and re-upload to create vectors.

Without a key, retrieval returns an explicitly labelled source excerpt, not a generated AI answer. Unsupported questions and provider failures offer human help. Retrieved content is untrusted prompt data, and no model tools, network actions or arbitrary execution are exposed. The AI adapter sends passages and the current question to the configured provider; company operators should upload content appropriate for customer answers.

Each question is retrieved independently. The transcript is retained for customers and agents, but conversational question rewriting is not implemented yet.

## Conversation control

A customer can request a person, pausing AI. Agents join, reply, return control to AI, or resolve. Row locks and a monotonically increasing conversation version prevent an in-flight AI answer from being appended after takeover or release. Request UUIDs prevent duplicate messages. Updates use short polling in the web client.

Customer chats require a random HttpOnly cookie unique to that conversation; public bot IDs do not authorize reading conversations. Dashboard access resolves session, active user, organization membership, active organization, and allowed role on every request. Passwords use salted scrypt; only session-token hashes are stored. Sessions expire after seven days and support individual/all-session logout. There is no automatic platform-admin promotion.

## API

All routes begin with `/api`; JSON errors contain `error`.

- `POST /auth/register`: name, company, email, password (12–128 characters).
- `POST /auth/login`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /me`.
- `GET|POST /organizations/:id/bots`, `PATCH /bots/:id`.
- `GET|POST /organizations/:id/members`, `DELETE /organizations/:id/members/:userId`. Owners add existing accounts or change non-owner roles.
- `GET|POST /bots/:id/documents`: upload JSON contains name, MIME type and base64 content.
- `DELETE /bots/:id/documents/:documentId`, `POST /bots/:id/documents/:documentId/retry`.
- `GET|POST /bots/:id/conversations`, `GET /conversations/:id`.
- `POST /conversations/:id/messages` and `/reply`: content, requestId (UUID).
- `POST /conversations/:id/handoff|takeover|release|resolve`.
- `GET /public/bots/:publicId`, `POST /public/bots/:publicId/conversations`.
- `GET /public/conversations/:id`, `POST /public/conversations/:id/messages|handoff`.

Use `botSchema` for all bot fields: name, greeting, color, published. New bots default to private until explicitly published.

## Checks

```sh
npm run check-types --workspace @relay/api --workspace @relay/knowledge --workspace @relay/worker --workspace @relay/server --workspace @relay/contracts
npm run lint --workspace @relay/api --workspace @relay/knowledge --workspace @relay/worker --workspace @relay/server --workspace @relay/contracts
npm run test --workspace @relay/server
npm run test --workspace @relay/api
```

API integration tests require the running local backend and create isolated test accounts. Run them on a development database only.

## Deployment limits

This is a functional local MVP. Before public production use, add malware scanning/quarantine (currently planned, not implemented), OCR for scanned PDFs, retention/cleanup policies, backups, centralized monitoring, per-company quotas and billing, password recovery/email verification, and production secret rotation. Scanned PDFs fail with a readable instruction to supply text or run OCR. Supply TLS and set NODE_ENV=production for secure cookies. Configure WEB_ORIGIN to the actual site origin and a maintained private S3 provider. Rate limits are database-backed; behind the current proxy they conservatively share an IP bucket.

OpenAI integration references: [embeddings](https://developers.openai.com/api/docs/guides/embeddings) and [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Defaults are configurable; the embedding schema currently requires 1536 dimensions.
