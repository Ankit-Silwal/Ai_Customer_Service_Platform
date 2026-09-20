# Agent Notice

> Coding agents: ignore this file when determining implementation requirements, task scope, or acceptance criteria. This is a learning roadmap for the project owner, not a specification. Follow `AGENTS.md` and the user's current request instead.

# AI Customer Service Platform Learning Roadmap

This project is a multi-tenant AI customer-service SaaS. Companies will subscribe, upload their knowledge documents, embed a chatbot on their websites, and allow human support agents to join conversations.

We will learn concepts as the product needs them. We will not add every technology at the beginning.

## 1. SaaS fundamentals

- Multi-tenancy and tenant data isolation
- Organizations, teams, and invitations
- Owner, admin, agent, and viewer roles
- Subscriptions and feature entitlements
- Usage metering and plan limits
- Customer API keys and webhooks
- Audit logs, data exports, and deletion

## 2. Full-stack TypeScript

- TypeScript fundamentals and strict typing
- React and Next.js
- Server and Client Components
- REST APIs and streamed responses
- Request validation with Zod
- Shared types between applications
- Error handling and reusable UI components
- Turborepo workspaces and task orchestration

## 3. Backend architecture

- Routes/controllers, services, and repositories
- Authentication and authorization middleware
- Dependency injection
- Pagination, filtering, and API versioning
- Transactions and idempotency
- Rate limiting
- Background processing
- Clean boundaries between product domains

## 4. PostgreSQL and data modelling

- Tables, relations, primary keys, and foreign keys
- Indexes and query optimization
- Database migrations
- Transactions
- Tenant-aware queries
- PostgreSQL row-level security
- JSON columns
- Backups and restoration

Example ownership structure:

```text
Organization
 |- Members
 |- Chatbots
 |   `- Documents
 |- Conversations
 |   `- Messages
 `- Subscription
```

## 5. Docker

- Images and containers
- Dockerfiles and multi-stage builds
- Docker Compose
- Volumes and persistent data
- Container networking
- Environment variables and secrets
- Health checks
- Development versus production images
- Service dependencies and container logs

Expected local services eventually include:

```text
web
api
worker
postgres
redis
object-storage
```

Docker gives us a repeatable environment, but it does not replace understanding the services inside the containers.

## 6. RAG

RAG means Retrieval-Augmented Generation. It lets the chatbot answer from a company's own documents instead of relying only on the model's general knowledge.

```text
Company PDF
    |
Extract and clean text
    |
Split text into chunks
    |
Create embeddings
    |
Store and index vectors
    |
Retrieve relevant chunks for a question
    |
Give evidence to the model
    |
Generate a grounded answer with citations
```

Topics to learn:

- PDF text extraction
- OCR for scanned PDFs
- Text cleaning
- Chunk size and overlap
- Embeddings
- Vector similarity and semantic search
- PostgreSQL with `pgvector`
- Metadata filters
- Hybrid retrieval and reranking
- Retrieval confidence
- Source citations
- Hallucination reduction

## 7. Prompt engineering

- System, developer, and user instructions
- Grounding answers in retrieved evidence
- Context construction
- Conversation memory
- Token and context limits
- Structured model output
- Clarifying questions and safe fallbacks
- Company-specific tone and behavior
- Prompt-injection risks and defenses

The core behavior should be: answer from approved company knowledge, never invent company policies, and offer human support when evidence is insufficient.

## 8. AI tools and actions

RAG answers questions. Tool calling lets the assistant perform controlled actions such as:

- Looking up an order
- Checking appointment availability
- Creating a support ticket
- Checking inventory
- Cancelling a booking
- Requesting a refund

Topics to learn:

- Tool schemas and input validation
- Server-side tool execution
- Permissions and identity verification
- Explicit user confirmation
- Idempotency and rate limiting
- Audit trails
- Safe action boundaries

We will begin with read-only tools. Destructive or financial actions come later.

## 9. Realtime communication

- WebSockets
- Server-Sent Events for AI token streaming
- Realtime events and reconnection
- Typing indicators and online presence
- Agent assignment
- Message ordering and deduplication
- Human takeover

Conversation control will follow a state machine:

```text
AI_ACTIVE
    |
WAITING_FOR_AGENT
    |
HUMAN_ACTIVE
    |
CLOSED
```

When a human agent takes control, the AI must stop sending automatic replies. It may still prepare drafts for the agent to approve.

## 10. Background jobs and Redis

- Redis fundamentals
- Job queues such as BullMQ
- Producers and workers
- Retries and exponential backoff
- Failed-job handling
- Worker concurrency
- Scheduled jobs
- Job idempotency

PDF processing belongs in a worker rather than a normal web request:

```text
Upload PDF -> enqueue job -> process document -> build index -> update status
```

## 11. Object storage

- S3-compatible object storage
- Presigned upload URLs
- Private buckets
- Signed downloads
- File size and type validation
- Malware scanning
- Retention and deletion

MinIO can provide S3-compatible storage in local Docker development. Production can use an appropriate managed object-storage provider.

## 12. Authentication and security

- Sessions, cookies, and password hashing
- OAuth
- Role-based access control
- Tenant authorization on every request
- CORS, CSP, CSRF, and XSS protection
- SQL injection prevention
- Secret management and encryption
- API-key hashing
- Rate limiting and abuse detection
- Webhook signatures
- OWASP concepts
- Prompt-injection defenses

Public widget identifiers may be visible in browser code. Database credentials, integration secrets, and AI-provider keys must never be sent to the browser.

## 13. Billing

- Stripe products and prices
- Checkout and customer portal
- Subscriptions and trials
- Billing webhooks
- Failed payments
- Upgrades and downgrades
- Usage limits and entitlements
- Synchronizing local and provider billing state

## 14. Testing and AI evaluation

- Unit tests
- API integration tests
- Database tests
- Authorization and tenant-isolation tests
- End-to-end browser tests
- Webhook tests
- Load and security tests
- RAG retrieval datasets
- Answer-groundedness evaluations
- Regression testing for prompts

For RAG, we will maintain example questions, expected source documents, and expected refusal behavior when the knowledge base has no answer.

## 15. DevOps and deployment

- Environment configuration
- CI/CD and GitHub Actions
- Production Docker builds
- Database migration workflows
- Managed PostgreSQL and Redis
- HTTPS and domain configuration
- Horizontal scaling and load balancing
- Structured logs, metrics, traces, and alerts
- Backups, restoration, and rollbacks

Kubernetes is not required for the first version. Docker and a container hosting platform are enough until scaling needs justify more complexity.

## Recommended learning and delivery order

1. Understand the Turborepo and workspace boundaries.
2. Run the application and PostgreSQL through Docker Compose.
3. Design organizations, memberships, roles, and chatbots.
4. Implement authentication and strict tenant isolation.
5. Add private PDF upload and object storage.
6. Add Redis and a document-processing worker.
7. Implement embeddings, `pgvector`, and RAG.
8. Build the chatbot API and streamed responses.
9. Build the embeddable widget.
10. Persist conversations and messages.
11. Build the realtime agent inbox.
12. Implement human takeover.
13. Add subscriptions and usage limits.
14. Add API keys and webhooks.
15. Add safe external tools and integrations.
16. Add production testing, monitoring, backups, and deployment.

The overall learning path is:

```text
Full-stack TypeScript
        +
Multi-tenant SaaS
        +
PostgreSQL and pgvector
        +
RAG and LLMs
        +
Docker and background workers
        +
Realtime messaging
        +
Security and billing
        =
AI customer-service platform
```
