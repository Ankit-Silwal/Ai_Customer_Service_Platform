# AI Customer Service Platform Implementation Plan

## Implementation approach

The project owner will first learn the fundamentals needed for the first major part. We will then implement that major part together. Later parts should follow the same learning and implementation cycle:

```text
Learn the required fundamentals
        |
Agree on the milestone scope and acceptance criteria
        |
Implement one vertical feature
        |
Test and review it
        |
Continue to the next milestone
```

Do not attempt to build the entire platform in one pass. Each phase must leave the repository in a working, understandable state.

## Phase 0: Fundamentals and project orientation

### Learn

- npm workspaces and Turborepo
- TypeScript fundamentals
- React and Next.js fundamentals
- HTTP, REST APIs, and JSON
- Environment variables and secret handling
- Docker images, containers, networks, and volumes
- Basic PostgreSQL and relational modelling

### Repository work

- Understand the existing `apps` and `packages` workspaces.
- Confirm the root scripts and workspace commands.
- Define naming, environment, and validation conventions.
- Document how to run the repository locally.

### Completion criteria

- The owner can explain the purpose of each existing workspace.
- The existing repository can be installed, linted, type-checked, built, and run.
- No product functionality is added during learning-only work unless separately requested.

## Phase 1: First major part — platform foundation

This is the first major implementation phase after the fundamentals are understood.

### Learn

- Docker Compose
- PostgreSQL schemas and migrations
- Backend routes, services, and repositories
- Authentication and session management
- Multi-tenancy
- Role-based access control
- Server-side input validation

### Build

- Docker Compose development environment
- PostgreSQL service with persistent storage and health checks
- API application workspace
- Shared database and contracts packages when required
- User authentication
- Organizations and organization memberships
- Owner, admin, agent, and viewer roles
- Chatbot records owned by an organization
- Server-side tenant authorization
- Initial dashboard for organization and chatbot management

### Initial endpoints

Endpoint names may be adjusted during API design, but the capabilities should remain focused:

```text
POST   /v1/auth/register
POST   /v1/auth/login
POST   /v1/auth/logout
GET    /v1/me

POST   /v1/organizations
GET    /v1/organizations
GET    /v1/organizations/:organizationId
PATCH  /v1/organizations/:organizationId

GET    /v1/organizations/:organizationId/members
POST   /v1/organizations/:organizationId/invitations
PATCH  /v1/organizations/:organizationId/members/:memberId
DELETE /v1/organizations/:organizationId/members/:memberId

POST   /v1/organizations/:organizationId/bots
GET    /v1/organizations/:organizationId/bots
GET    /v1/bots/:botId
PATCH  /v1/bots/:botId
DELETE /v1/bots/:botId
```

### Completion criteria

- Services start predictably through Docker Compose.
- A user can authenticate and create an organization.
- An organization owner can manage members and create a chatbot.
- Users cannot access another organization's data by changing IDs in a request.
- Authorization and tenant-isolation tests pass.
- Setup and environment documentation is current.

## Phase 2: Document storage and ingestion

### Learn

- Object storage and presigned uploads
- File validation and malware-scanning concepts
- Redis and background queues
- Worker processes
- Retry and idempotency patterns
- PDF text extraction and OCR

### Build

- Local S3-compatible object storage through Docker
- Redis and a worker application
- Private PDF uploads
- File type and size validation
- Document processing statuses
- Asynchronous text extraction
- Retry and failure reporting
- Document deletion from storage and the database

### Endpoints

```text
POST   /v1/bots/:botId/documents/upload-url
POST   /v1/bots/:botId/documents
GET    /v1/bots/:botId/documents
GET    /v1/documents/:documentId
POST   /v1/documents/:documentId/reprocess
DELETE /v1/documents/:documentId
```

### Completion criteria

- A permitted organization member can upload a valid PDF.
- Processing happens outside the web request.
- The UI displays uploaded, processing, ready, and failed states.
- Invalid, oversized, and unauthorized uploads are rejected.
- Deleting a document removes its stored file and derived data safely.

## Phase 3: RAG knowledge system

### Learn

- Embeddings and vector similarity
- Chunking and metadata
- PostgreSQL `pgvector`
- Semantic and hybrid retrieval
- Reranking
- Retrieval evaluation
- Source citations and grounding

### Build

- Text cleaning and chunking
- Embedding generation
- Tenant-isolated vector storage
- Retrieval scoped to one chatbot
- Source and page metadata
- Knowledge testing screen
- Evaluation dataset for expected retrieval results

### Endpoints

```text
POST /v1/bots/:botId/knowledge/search
POST /v1/bots/:botId/knowledge/test
GET  /v1/documents/:documentId/chunks
```

The chunk-list endpoint must be restricted to authorized dashboard users and must not expose another tenant's content.

### Completion criteria

- Retrieval returns relevant chunks only from the selected chatbot.
- Results retain document, page, and section metadata where available.
- Cross-tenant retrieval tests pass.
- Known evaluation questions retrieve their expected sources.
- Low-confidence retrieval is identifiable.

## Phase 4: AI conversation API

### Learn

- Model APIs and streaming
- Prompt construction
- Conversation context management
- Structured outputs
- Token and cost accounting
- Hallucination and prompt-injection defenses

### Build

- Public visitor sessions
- Conversation and message persistence
- RAG-grounded AI responses
- Source citations
- Streamed responses
- Safe fallback when knowledge is insufficient
- Per-bot instructions and tone
- Rate limits and usage events

### Endpoints

```text
POST /v1/public/bots/:publicBotId/sessions
POST /v1/public/conversations
GET  /v1/public/conversations/:conversationId
POST /v1/public/conversations/:conversationId/messages
POST /v1/public/conversations/:conversationId/handoff
```

Public endpoints must use short-lived visitor credentials, allowed-domain checks where possible, and abuse controls. They must never accept an organization ID as proof of access.

### Completion criteria

- A visitor receives streamed, grounded answers.
- Answers cite the supporting company documents.
- The chatbot refuses unsupported company-specific claims.
- Conversation history persists correctly.
- Rate and usage limits are enforced server-side.

## Phase 5: Embeddable website widget

### Learn

- Browser SDK and widget architecture
- Cross-origin communication
- Content Security Policy
- Theme configuration
- Accessibility
- Session persistence and reconnection

### Build

- Independently buildable widget workspace
- Small customer installation snippet
- Public bot identifier
- Configurable branding, greeting, and colors
- Visitor session persistence
- Streaming message UI
- Citation presentation
- Human-support request control
- Allowed-domain configuration

### Completion criteria

- A customer can install the widget using a documented script snippet.
- The widget does not expose private credentials.
- It works on desktop and mobile layouts.
- Keyboard navigation and essential accessibility behavior work.
- Reconnection does not duplicate messages.

## Phase 6: Realtime human agent inbox

### Learn

- WebSockets and realtime events
- Presence and typing indicators
- Message ordering and deduplication
- Assignment and queue design
- State machines

### Build

- Agent conversation inbox
- Unassigned, assigned, and closed queues
- Realtime visitor and agent messages
- Agent assignment
- Internal notes and tags
- Typing and presence events
- Human takeover state machine
- AI-generated drafts requiring agent approval

### Endpoints and events

```text
GET  /v1/conversations
GET  /v1/conversations/:conversationId
POST /v1/conversations/:conversationId/assign
POST /v1/conversations/:conversationId/takeover
POST /v1/conversations/:conversationId/return-to-ai
POST /v1/conversations/:conversationId/close
POST /v1/conversations/:conversationId/messages
POST /v1/conversations/:conversationId/notes
```

Realtime events should include message creation, assignment changes, conversation-state changes, typing, and presence.

### Completion criteria

- New conversations appear in the correct organization's inbox.
- Agents can claim, reply to, and close conversations.
- The AI stops automatic replies during human control.
- Realtime reconnects preserve ordering without duplicate messages.
- Authorization tests cover conversations, notes, and assignments.

## Phase 7: Billing, API access, and webhooks

### Learn

- Subscription lifecycles
- Stripe checkout and webhooks
- Entitlements and quotas
- API-key design and hashing
- Webhook signing and delivery retries

### Build

- Products, prices, and subscriptions
- Checkout and billing portal
- Trial and failed-payment handling
- Server-side plan entitlements
- Usage dashboard
- Customer API keys
- Versioned public API documentation
- Signed outbound webhooks
- Webhook delivery attempts and retries

### Endpoints

```text
POST /v1/billing/checkout
POST /v1/billing/portal
GET  /v1/billing/subscription
GET  /v1/usage

POST   /v1/api-keys
GET    /v1/api-keys
DELETE /v1/api-keys/:apiKeyId

POST   /v1/webhook-endpoints
GET    /v1/webhook-endpoints
PATCH  /v1/webhook-endpoints/:endpointId
DELETE /v1/webhook-endpoints/:endpointId
```

Provider webhook routes must verify signatures and handle duplicate deliveries idempotently.

### Completion criteria

- Subscription state changes update local entitlements safely.
- Plan limits are enforced on the server.
- Secret API keys are displayed once and stored only as secure hashes.
- Outbound webhooks are signed, retried, and auditable.
- Billing and webhook test cases cover duplicate and out-of-order events.

## Phase 8: Safe tools and customer integrations

### Learn

- LLM tool calling
- Integration credentials and encryption
- Identity verification
- Action confirmation
- Idempotent external mutations
- Audit trails and compensation strategies

### Build order

1. Read-only order or account lookup.
2. Support-ticket creation.
3. Appointment availability and booking with confirmation.
4. Carefully controlled cancellation or refund requests.

Each tool must have a validated schema, explicit permissions, server-side execution, rate limits, audit events, and confirmation for consequential actions. The model must never receive unrestricted database, HTTP, or code-execution access.

### Completion criteria

- Tools run only for the correct organization and authenticated visitor context.
- Read and write permissions are separate.
- Consequential actions require confirmation.
- Retries cannot duplicate an action.
- Every action is auditable.

## Phase 9: Production readiness

### Learn and implement

- CI/CD
- Production container builds
- Managed infrastructure
- Database migration and rollback procedures
- Logs, metrics, traces, and alerts
- Backup and restore testing
- Load testing
- Security review
- Data retention, export, and deletion
- Incident response

### Completion criteria

- CI runs required checks for every change.
- Production deployments use immutable artifacts.
- Migrations, backups, and restores have documented procedures.
- Alerts cover API errors, queue failures, latency, and exhausted quotas.
- Tenant isolation, file security, billing, and tool execution have been reviewed.
