# 0016. Production Compose file

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

`deploy/nas/docker-compose.yml` still has `build:` and a single superuser password. The feature PR replaces it with `docker-compose.unraid.yml`.

## Context

Root `docker-compose.yml` is the laptop and cloud-agent stack. It builds and publishes ports ([0001](0001-self-host-on-unraid.md)). The NAS file must not. [0013](0013-security-review.md) requires a strong password, limited roles, an internal database network, and no published Postgres port, on both files. Taylor confirmed the local half stays that follow-up, not this feature. Detail is in [unraid production](../unraid-production.md).

## Options considered

1. **One Unraid file at the repo root, `docker-compose.unraid.yml`, pulling the GHCR images.** Dev stays `docker-compose.yml`. Taylor asked for the Unraid file at the top level so it is easy to find. Recommended.
2. **Keep the Unraid file at `deploy/nas/docker-compose.yml`.** Same contents, one directory deeper. Taylor rejected this.
3. **Keep building on the NAS.** No registry lag. The NAS needs a toolchain, and a public clone is what gets compiled.

## Decision

Use option 1. `docker-compose.unraid.yml` pulls `ghcr.io/ferrisweil/cookbook-api`, `cookbook-web`, and `cookbook-mcp` at `COOKBOOK_IMAGE_TAG`. It has no `build:` key. Secrets come from the env file on the NAS (`:?`, no defaults). Postgres follows [0013](0013-security-review.md): no `ports:`, internal network with only `db` and `api`, `postgres:16-alpine`, and the three passwords `POSTGRES_SUPERUSER_PASSWORD`, `POSTGRES_MIGRATOR_PASSWORD`, and `POSTGRES_APP_PASSWORD`. The dev password `cookbook` is not a value in this file.

This supersedes the Unraid path in [0001](0001-self-host-on-unraid.md) and [0009](0009-repo-layout.md). Those ADRs name `deploy/nas/docker-compose.yml`. Nginx and the Tailscale config stay in `deploy/nas/`. The feature PR deletes the old compose file so only one Unraid file remains.

The feature PR teaches the API to use the migrator role for migrations and `cookbook_app` for requests when those env vars are set. When they are absent, the API keeps today's single `POSTGRES_USER` / `POSTGRES_PASSWORD` path so `docker compose up --build` still needs no env file ([0007](0007-public-repo-secrets.md)).

The root compose file is unchanged in that feature PR. [0013](0013-security-review.md) still requires the local follow-up (no published `5432`, no default password, same roles). This ADR sequences that work. It does not cancel it.

## Consequences

* `pnpm smoke` renders `docker-compose.unraid.yml` with dummy values and does not start it. The `db` healthcheck uses `pg_isready -U postgres`. `pnpm check` includes a unit test that the file names the three images and has no `build:` or `ports:` key.
* An existing `postgres/` directory from the skeleton must be renamed before first boot. The init script runs only on an empty data directory. There are no family recipes in that directory ([0004](0004-postgres-migrations.md)).
* Placeholder env keys live in `deploy/nas/.env.example`. The feature PR points the root `.env.example` at that file and removes the NAS-only keys from the root example so the two templates do not disagree. Local compose still starts with no env file.
* This is the ADR that allows the feature PR to add `docker-compose.unraid.yml` and delete `deploy/nas/docker-compose.yml`. Later features still leave the Unraid file alone ([parallel agents](../parallel-agents.md)).
