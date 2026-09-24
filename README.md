# Relay — AI customer support, with a human touch

A company workspace for document-based support. Upload knowledge, test your assistant on this website, publish a customer chat page, and let a real teammate join the same conversation.

## What works

- Email/password accounts and organization-scoped owner, admin, agent and viewer access.
- Multiple assistants with separate knowledge and conversations.
- Private PDF, TXT and Markdown uploads, asynchronous processing, status, retry and deletion.
- Hybrid lexical/vector retrieval, source citations and an OpenAI-compatible AI provider.
- A built-in playground and shareable customer chat page.
- A team inbox with human takeover, agent replies, return to AI and resolution.
- Responsive dashboard and customer chat, bundled fonts and accessible dialogs.

Without an AI key the assistant returns clearly labelled source excerpts. Add `AI_API_KEY` in the server environment for generated answers and embeddings. No provider secrets are sent to the browser.

## Run everything in Docker

Requires Docker Desktop.

```sh
node scripts/setup-platform.mjs
docker compose --env-file .env.platform -f compose.platform.yml up --build -d
```

Open **http://localhost:3000**. The migration runs automatically before the services start. Database and document files persist in named volumes. `npm run platform:up` and `npm run platform:down` are equivalent shortcuts after installing dependencies. Stopping the stack keeps its volumes.

## Run locally

Requires Node.js 24+, npm and Docker.

```sh
npm install
npm run platform:setup
npm run platform:infra
npm run dev:platform
```

Open **http://localhost:3000**, create an account and use **Knowledge base → Add sample knowledge** or upload your own document. Wait for Ready, then ask a question in Playground.

To test a real person joining: request a person in the chat, open Team inbox, select the conversation and click Join conversation. To test as a customer in a separate browser, publish the bot in Bot settings and open its customer chat link. That link is public; conversation history is private to its visitor and authorized teammates.

Local settings are in ignored `.env.platform`. Setup generates random credentials and preserves existing valid settings. The pre-existing identity-service workspace and its Compose configuration are separate from Relay.

## Services

| Workspace            | Responsibility                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `apps/web`           | React dashboard, playground, customer chat and agent inbox       |
| `apps/api`           | Gateway, accounts, tenant authorization and conversation control |
| `apps/knowledge`     | Private uploads, retrieval and model responses                   |
| `apps/worker`        | Background text extraction, chunks and embeddings                |
| `packages/contracts` | Shared Zod schemas and DTOs                                      |
| `packages/server`    | Server-only database, AI, storage and security adapters          |
| `packages/ui`        | Reusable UI primitives                                           |

PostgreSQL with pgvector stores metadata, passages, sessions and conversations. Private object storage holds original files. The database also provides durable jobs with leases/retries. Services run independently; this initial deployment shares a database.

See [architecture, API and operational limits](docs-platform.md) and [local infrastructure](docs-infrastructure.md).

## Verify

```sh
npm run check-types --workspace @relay/web --workspace @relay/api --workspace @relay/knowledge --workspace @relay/worker --workspace @relay/server --workspace @relay/contracts --workspace @repo/ui
npm run lint --workspace @relay/web --workspace @relay/api --workspace @relay/knowledge --workspace @relay/worker --workspace @relay/server --workspace @relay/contracts --workspace @repo/ui
npm run build --workspace @relay/web --workspace @relay/api --workspace @relay/knowledge --workspace @relay/worker
npm run test --workspace @relay/server
npm run test --workspace @relay/api
npm run test:e2e --workspace @relay/web
```

GitHub Actions builds the full Docker stack and runs lint, type checks, unit, API, PDF ingestion, takeover-race and browser tests.

Integration and browser tests require running services and create test workspaces. Browser tests use installed Chrome by default (`PLAYWRIGHT_CHANNEL=msedge` is also supported). Test artifacts and credentials stay ignored. Registration is rate limited to five requests per hour per IP, so use a dedicated development environment for repeated registration tests.

The local MVP does not yet include malware scanning, OCR, password recovery, email verification, billing, or production operational hardening. Scanned PDFs are rejected with a clear message. Review the deployment limits before using real customer data publicly.
