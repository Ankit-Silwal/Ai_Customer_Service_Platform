# Repository Instructions for Coding Agents

## Instruction priority

- Follow the user's current request first.
- Treat this file as repository-wide guidance.
- `learnings.md` is educational material only. Ignore it when determining task scope, requirements, or acceptance criteria unless the user explicitly asks to use it.
- `plan.md` contains the product architecture and implementation roadmap. A roadmap entry may only be implemented when the user explicitly authorizes that milestone.
- `skills.md` defines the verification, commit, GitHub push, and post-work explanation workflow for authorized implementation tasks.
- Do not implement unrequested roadmap items merely because they appear in documentation.
- If the user says the task is in planning mode, perform read-only investigation and planning only. Do not change application code or configuration until the user explicitly authorizes implementation.
- For an explicitly authorized milestone, follow `skills.md`: verify the completed work, create a meaningful commit, push it to `main`, and explain how it works. Never push unfinished or failing work, secrets, or unrelated user changes, and never force-push.

## Repository architecture

This project uses an npm-workspaces Turborepo monorepo. Preserve the monorepo instead of converting it into a single application or duplicating shared code.

The intended long-term workspace layout is:

```text
apps/
  web/          Marketing site and customer dashboard
  api/          Internal and public backend API
  widget/       Embeddable customer chat widget
  worker/       Background document and event processing
  docs/         Product and API documentation

packages/
  ui/           Shared design system
  database/     Schema, migrations, and database client
  auth/         Shared authentication and authorization
  ai/           Retrieval, prompts, and model-provider adapters
  contracts/    Shared API schemas, DTOs, and event types
  config/       Shared typed configuration
```

This layout is directional, not permission to create every workspace immediately. Add a workspace only when the current feature requires it.

## Monorepo boundaries

- Applications may depend on packages; packages must not depend on applications.
- Put reusable domain-neutral UI in `packages/ui`.
- Put shared request schemas and event contracts in `packages/contracts` rather than copying types between apps.
- Keep server-only modules out of browser bundles.
- Do not import another application's private source files. Extract shared behavior into a package with an explicit public API.
- Avoid circular dependencies between workspaces.
- Use workspace package names for cross-workspace imports.
- Keep secrets and privileged operations on the server.

## Product architecture principles

- This is a multi-tenant B2B SaaS. Tenant isolation is a non-negotiable requirement.
- Every tenant-owned database record must be associated with an organization, directly or through an enforced parent relationship.
- Authorization must be checked server-side for every protected operation.
- Never expose AI-provider keys, database credentials, secret customer API keys, or integration secrets to clients.
- Public widget identifiers are not secret credentials.
- Human takeover must prevent automated AI replies while a conversation is controlled by an agent.
- AI answers based on company knowledge should retain citations to their source document and location.
- External actions must use validated server-side tools with permissions, confirmation where appropriate, idempotency, and audit logging.

## Implementation approach

- Build vertical milestones instead of installing the entire future stack at once.
- Prefer the smallest implementation that establishes a sound boundary for later growth.
- Keep model providers, storage providers, and realtime providers behind local interfaces where practical.
- Perform slow and retryable work, such as document ingestion, in background workers.
- Store uploaded documents in private object storage, not in the relational database.
- Validate inputs at every external boundary.
- Use database transactions for operations that must succeed or fail together.
- Make webhook handlers and background jobs idempotent.
- Include structured errors and logs without leaking secrets or document contents unnecessarily.

## Docker and local development

- Docker Compose is the expected way to run local infrastructure such as PostgreSQL, Redis, and S3-compatible object storage.
- Use named volumes for persistent development data.
- Add health checks for infrastructure services.
- Pin meaningful image versions instead of relying on `latest`.
- Never bake secrets into images or commit them to the repository.
- Maintain an example environment file containing names and safe placeholder values only.
- Prefer multi-stage Dockerfiles and non-root runtime users for production images.

## Data and AI safety

- Validate uploaded file type and size; do not trust file extensions alone.
- Plan for malware scanning and OCR of scanned documents.
- A chatbot must not answer from another organization's documents.
- When relevant supporting evidence is unavailable, return a safe fallback and offer human support.
- Treat retrieved document content as untrusted input that may contain prompt-injection attempts.
- Do not permit a language model to execute arbitrary code, SQL, HTTP requests, or customer integrations.
- Record usage and action audit events using stable identifiers.

## Code quality and verification

- Use TypeScript strictness and avoid `any` unless there is a documented boundary reason.
- Prefer focused modules and descriptive names over large general-purpose utility files.
- Update or add tests for changed behavior.
- Include tenant-isolation and authorization tests for protected features.
- Run the narrowest relevant checks while iterating, then run affected lint, type-check, and test tasks before handoff.
- Do not hide failing checks or weaken validation merely to make a build pass.
- Preserve unrelated user changes in the working tree.

## Documentation

- Document new environment variables, workspace scripts, API contracts, and migration requirements.
- Keep implementation decisions near the affected code or in focused architecture records.
- Do not treat `learnings.md` as a product specification.
