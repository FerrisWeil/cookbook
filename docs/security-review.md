# Security review

Checklist for [0013](decisions/0013-security-review.md). Supply-chain pins are [supply-chain.md](supply-chain.md).

Run this list before a pull request is marked ready. Add a Security section only when a check fails or the diff needs an exception: a new `allowBuilds` entry, an `audit.ignore` GHSA, a moderate advisory CI left green, a secret, a published database port, a workflow permission change, or an Action or image that is not pinned. A clean change leaves the section out. gitleaks and `pnpm audit --audit-level=high` block a clean pull request. There is no second review bot.

## Dependencies

- New or updated direct dependencies, and why.
- Who maintains each one, and whether it is abandoned.
- Install scripts. `allowBuilds` in `pnpm-workspace.yaml` is the gate. The only entry is `esbuild`.
- `pnpm audit --audit-level=high`. High fails CI. Moderate findings are named and do not fail CI.

## Secrets and env

- No new secret, token, recipe, or note in git. `.env.example` holds placeholders only.
- No default password or token in a Compose file. The local MCP token below is the exception [0007](decisions/0007-public-repo-secrets.md) allows.

## Auth and tokens

- v1 has no household login.
- Every new API route and MCP tool says whether the bearer secret is required.
- Unauthenticated responses stay status-only.

MCP today:

- `MCP_AUTH_TOKEN` is required. Fewer than 16 characters refuses to boot.
- Compare with SHA-256 and `timingSafeEqual`.
- Missing or wrong token: `401` and `WWW-Authenticate: Bearer`.
- `GET /health` is unauthenticated and returns `{ "status": "ok" }`.
- Local Compose sets `MCP_ALLOW_DEV_TOKEN=1` and may boot with `local-dev-token-not-for-nas`. The NAS file does not set that flag. The placeholder `replace-me` is refused.

## Network

- The NAS Compose file has no `ports:` and no Tailscale Funnel.
- Every published local port is named, with the bind address. Postgres is not in that list.
- Web and MCP are not on the database network.

Local Compose publishes `3000` (API), `8787` (MCP), and `8080` (web). It does not publish `5432`.

## Images and Compose

- Image, capabilities, mounts, and env for each service this pull request changes.
- Read the local Compose file and the NAS file separately. The accepted Unraid file is not in the tree. Until it is, the NAS file is `deploy/nas/docker-compose.yml`.

## Data and logging

- Logs, errors, fixtures, and screenshots contain no recipes, notes, or tokens.

## Postgres

The local Compose file applies this. The NAS skeleton still connects the API as the superuser `cookbook` on one shared network, with `POSTGRES_PASSWORD`. That file changes when `docker-compose.unraid.yml` is added ([0015](decisions/0015-production.md)).

### Passwords

The env file supplies the passwords. Compose uses `${VAR:?}` and has no `:-cookbook` fallback. Generate each value with `openssl rand -base64 24`.

| Env | Role | Who uses it |
| --- | --- | --- |
| `POSTGRES_SUPERUSER_PASSWORD` | `postgres` superuser | First-boot init only. Not set on the API container. |
| `POSTGRES_MIGRATOR_PASSWORD` | `cookbook_migrator` | API, only while applying migrations and seed. |
| `POSTGRES_APP_PASSWORD` | `cookbook_app` | API request pool. |

`cookbook_migrator` owns the `cookbook` database, is `NOSUPERUSER`, and runs DDL. `cookbook_app` is `NOSUPERUSER` and receives `SELECT`, `INSERT`, `UPDATE`, and `DELETE` through default privileges. It has no `CREATE`. `db/init/01-roles.sh` runs from `docker-entrypoint-initdb.d` on an empty data directory.

### Port and network

`db` has no `ports:` key. The API uses the hostname `db` on a Docker network named `db` with `internal: true`. Members are `db` and `api`.

Web and MCP are on the `app` network. They do not resolve `db`.

`psql` from the host is `docker compose exec db psql -U postgres`. No localhost publish.

### What the password does not do

The password stops a container that can open a TCP connection. It does not stop a shell on the NAS, or someone who can read the data directory. Postgres does not encrypt that directory. Unraid disk encryption is the control for a disk that leaves the house.

Directory mode, shares, and backup steps are in the Unraid doc. After first start the Postgres image owns the data directory. Do not chown it back while the database is running.
