# Feature: supply-chain pins and local Postgres roles

* Status: in progress
* Related ADRs: [0013](../docs/decisions/0013-security-review.md), [0014](../docs/decisions/0014-supply-chain.md)
* Demo: `pnpm check` and `pnpm smoke` in CI. No browser demo. Functional tests are not written.

## What it does

Closes the local half of the accepted security review and the supply-chain pins. Dependabot opens grouped weekly version updates and security updates. `pnpm check` fails on high npm advisories. GitHub Actions are pinned to commit SHAs. Third-party images in the Dockerfiles and the local Compose file are pinned to a tag and a digest. Local Postgres uses `cookbook_migrator` for migrations and `cookbook_app` for requests, on an internal network, with no published port and no default password.

`deploy/nas/docker-compose.yml` is unchanged. The agent that owns the NAS stack and GHCR publishing applies the requirements in [supply chain](../docs/supply-chain.md).

## Acceptance checks

- [ ] `pnpm check` includes `pnpm audit --audit-level=high` and stays green
- [ ] `pnpm smoke` boots the local stack with generated passwords and does not print them
- [ ] `GET /health/ready` reports the database up and the seed applied, which the app role can read
- [ ] `cookbook_app` cannot `CREATE TABLE`
- [ ] `cookbook_app` and `cookbook_migrator` are not superusers
- [ ] The API container does not have `POSTGRES_SUPERUSER_PASSWORD`
- [ ] Postgres has no published host port
- [ ] Third-party `FROM` and `image:` lines in the local Dockerfiles and Compose file include `@sha256:`
- [ ] CI actions are full SHAs and checkout does not persist credentials
- [ ] `.env.example` has placeholders only
- [ ] `deploy/nas/docker-compose.yml` is not edited

## How to run it

```bash
cp .env.example .env
# openssl rand -base64 24 for each of the three POSTGRES_* passwords
docker compose up --build
```

Then:

* Web: http://localhost:8080
* API: http://localhost:3000/health and `/health/ready`
* Postgres: `docker compose exec db psql -U postgres -d cookbook`
* MCP token is still the local dev token, not a database password

An existing volume created before these roles will not re-run `db/init`. Remove it with `docker compose down -v` before the first boot. There is no production data in the local volume.

## Tests

- Unit: `apps/api/test/config.test.ts` covers the two connection strings, rejected passwords, the init script, the unpublished port, and image digests
- Smoke: `scripts/smoke.sh` checks roles, the missing superuser password on the API, and the unpublished port
- Functional (browser): not written. Taylor has not confirmed a browser demo.
