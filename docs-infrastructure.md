# Relay infrastructure milestone

This adds isolated local infrastructure for the customer-support platform. It preserves the existing identity-service work and its Docker Compose file.

## Start

```sh
node scripts/setup-platform.mjs
docker compose --env-file .env.platform -f compose.infra.yml up -d
```

The setup command creates ignored `.env.platform` settings with random database, storage, and service credentials. Existing valid settings are preserved. Never commit that file.

- PostgreSQL 17 with pgvector: localhost:5440.
- Private S3-compatible object storage: localhost:9100.
- Storage console: localhost:9101. Credentials are in your local environment file.
- Named Docker volumes preserve data across restarts.
- Infrastructure ports bind only to localhost.
- No application account or public bucket is created.

## Verify

```sh
docker compose --env-file .env.platform -f compose.infra.yml ps
docker compose --env-file .env.platform -f compose.infra.yml exec postgres pg_isready -U relay -d relay
```

The platform services and dashboard are delivered in subsequent commits. The backend milestone will add tenant-scoped records, document indexing, conversations, messages, sessions, usage, and audit events.

MinIO uses its upstream Quay registry because its Docker Hub image is unavailable. This pinned image is for local development. Production should use a maintained private S3-compatible service, TLS, managed secrets, backups, malware scanning, and independent service credentials.
