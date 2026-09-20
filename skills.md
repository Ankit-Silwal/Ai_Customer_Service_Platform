# Project Delivery Skills and Workflow

## Purpose

This file describes how coding agents should verify, explain, commit, and deliver completed work. Product architecture and implementation phases belong in `plan.md`. Educational topics belong in `learnings.md`.

These instructions apply only after the user has explicitly authorized implementation work. A roadmap entry in `plan.md` is not authorization to begin it.

## Work in coherent milestones

- Complete one coherent milestone at a time.
- Do not mix unrelated roadmap work into the same change.
- Preserve unrelated changes already present in the working tree.
- Finish the requested acceptance criteria before calling a milestone complete.
- Keep the repository in a working and understandable state after each milestone.

## Verification skill

Before committing completed work:

1. Inspect `git status` and the complete diff.
2. Confirm that only files belonging to the milestone will be staged.
3. Verify that no secrets, credentials, local environment values, temporary files, or generated private data are included.
4. Run the affected lint, type-check, unit, integration, migration, and build checks.
5. Run tenant-isolation, authorization, and security tests when the feature affects protected data.
6. Update relevant documentation and environment examples.
7. Record any check that could not run and explain why.

Do not weaken validation, skip required checks, or conceal a failure merely to finish a milestone.

## Commit skill

- Stage only the completed milestone's files.
- Use a concise, meaningful conventional commit message that describes the outcome.
- Prefer messages such as:

```text
chore: add dockerized local development services
feat: add user authentication and sessions
feat: add tenant-scoped chatbot management
feat: add private document upload workflow
feat: stream rag-grounded chatbot responses
test: cover organization authorization boundaries
docs: document the monorepo development workflow
```

- Avoid vague messages such as `update`, `changes`, `work`, or `fix stuff`.
- Review the created commit and confirm it contains exactly the intended changes.
- Do not amend, squash, or rewrite commits that may already be shared unless the user explicitly asks for it and the operation is safe.

## GitHub push skill

After an authorized milestone is complete, verified, and committed:

1. Push the completed commit to the GitHub `main` branch.
2. Confirm that the remote accepted the push.
3. Report the commit identifier and pushed branch to the user.
4. Continue to the next milestone only after the current milestone is safely delivered.

Never push unfinished work, failing work, secrets, or unrelated user changes. Never use `--force` or rewrite shared history.

If the push is rejected because the remote has newer commits, stop and inspect the divergence. Do not automatically overwrite or rebase away another person's work. If authentication, branch protection, required reviews, unavailable GitHub access, or another external condition prevents the push, report the exact blocker instead of bypassing it.

## Explanation skill

After completing and pushing a milestone, give the user a self-contained explanation. The user should not need to inspect the commit to understand the result.

The standard explanation should cover:

- The outcome and user-visible behavior
- The main files, applications, and packages changed
- How the feature works from end to end
- The important request, event, or data flow
- Database migrations, environment variables, services, and commands introduced
- Security and tenant-isolation behavior
- Tests and checks that ran, including anything that could not run
- Known limitations or intentionally deferred work
- The commit identifier and confirmation that it was pushed to `main`

Keep the default explanation focused and understandable.

## Deep-explanation skill

If the user asks for an in-depth explanation, expand the handoff to include:

- Why the architecture was chosen
- The responsibilities and boundaries of every affected module
- A step-by-step walkthrough from the UI or API entry point to persistence and response
- Database tables, relationships, indexes, queries, and transaction boundaries
- Authentication, authorization, validation, rate limiting, and error paths
- Background jobs, retries, idempotency, and realtime events where applicable
- AI retrieval, prompt construction, citations, tool execution, and safety controls where applicable
- Important alternatives considered and their tradeoffs
- How to run, debug, test, maintain, and extend the feature

Use small diagrams or examples when they materially improve understanding. Do not claim that a test, push, deployment, or behavior succeeded unless it was actually verified.

## Delivery checklist

1. Acceptance criteria are satisfied.
2. The diff has been reviewed.
3. No secrets or unrelated changes are staged.
4. Relevant checks pass.
5. Documentation is updated.
6. The milestone has a meaningful commit.
7. The commit has been pushed to `main` without force.
8. The remote push has been confirmed.
9. The user has received the standard explanation.
10. A deep technical explanation is provided if the user requests it.
