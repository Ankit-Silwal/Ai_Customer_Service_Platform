# Relay infrastructure milestone

This adds isolated local infrastructure for the customer-support platform. It preserves the existing identity-service work and its Docker Compose file.

## Start

```sh
node scripts/setup-platform.mjs
docker compose --env-file .env.platform -f compose.infra.yml up --build -d
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

The full `compose.platform.yml` stack also starts the API, knowledge service, document worker and web application, with a one-shot migration before application startup.

MinIO community container images are no longer publicly pullable. `Dockerfile.storage` builds the official [source-only distribution](https://github.com/minio/minio#source-only-distribution) at release `RELEASE.2025-10-15T17-29-55Z`, immutable commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`. It includes the upstream AGPL license. The first build downloads Go dependencies and may take several minutes; later builds use Docker cache. Go checks module integrity through the upstream go.sum. No third-party mirror or registry credentials are required.

The existing named storage volume and root UID remain compatible with the previous local container. Back up development volumes before changing storage versions; do not delete volumes to fix a startup problem. This archived community source build is a local/demo dependency, not a maintained production storage service. Production should use maintained private S3-compatible storage, TLS, managed secrets, backups, malware scanning, and independent service credentials.
