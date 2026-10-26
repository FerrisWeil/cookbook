# Security review

Checklist for accepted [0013](decisions/0013-security-review.md) and [0014](decisions/0014-supply-chain.md). Status is **accepted** (2026-10-26, merged means accepted). The local Compose file follows it. `deploy/nas/` is updated by the agent that owns that file. The accepted Unraid file will be `docker-compose.unraid.yml` once [0017](decisions/0017-production-compose.md) is implemented. Until then it is still `deploy/nas/docker-compose.yml`.

Authors use this list before opening a pull request. The PR body stays the short template. Add a Security section only when a check fails or the diff needs an exception: a new `allowBuilds` entry, an `audit.ignore` GHSA, a moderate advisory that CI left green, a secret, a published database port, a workflow permission change, or an Action or image that is not pinned. Taylor said so on 2026-10-25. gitleaks and `pnpm audit --audit-level=high` are what block a clean PR. There is no second review bot.

## Dependencies

- New or updated direct dependencies, and why this PR needs them.
- Who maintains each one, and whether it is abandoned.
- Install scripts. `pnpm-workspace.yaml` `allowBuilds` is the gate. Today the only entry is `esbuild`.
- `pnpm audit --audit-level=high` result. High severity fails CI. Moderate findings are listed here and do not fail CI.

## Secrets and env

- No new secret, token, recipe, or note in git. `.env.example` gained placeholders only.
- No default password or token in a Compose file.

## Auth and tokens

- Every new API route and MCP tool says whether the MCP bearer token is required.
- Unauthenticated responses stay status-only. `GET /health` is the current example. No recipe, note, or token in that body.

## Network

- NAS Compose gained no `ports:` and no Tailscale Funnel.
- Every published local port is named, with the bind address. Postgres is not in that list.
- Web and MCP are not on the database network. If a PR puts them there, it says why.

## Images and Compose

- Image, capabilities, mounts, and env for each service this PR changes.
- Read the local Compose file and the Unraid file separately. The Unraid file is `docker-compose.unraid.yml` once [0017](decisions/0017-production-compose.md) is implemented. Until then it is still `deploy/nas/docker-compose.yml`.

## Data and logging

- Logs, errors, fixtures, and screenshots contain no recipes, notes, or tokens.

## Postgres

Accepted baseline. The local Compose file applies it. The Unraid file is still the single superuser on one shared network until the agent that owns `deploy/nas/` applies the same rules.

### Password

The env file supplies the password. It is never committed. `.env.example` holds placeholders only (`replace-me`). Generate each value with `openssl rand -base64 24`. Compose uses `${VAR:?}` and has no `:-cookbook` fallback.

Three values, so the app password is not the superuser password:

| Env | Role | Who uses it |
| --- | --- | --- |
| `POSTGRES_SUPERUSER_PASSWORD` | `postgres` superuser | First-boot init only. Not set on the API container. |
| `POSTGRES_MIGRATOR_PASSWORD` | `cookbook_migrator` | API, only while applying migrations and seed. |
| `POSTGRES_APP_PASSWORD` | `cookbook_app` | API request pool. |

`cookbook_migrator` owns the `cookbook` database, is `NOSUPERUSER`, and runs DDL. `cookbook_app` is `NOSUPERUSER` and receives `SELECT`, `INSERT`, `UPDATE`, and `DELETE` through default privileges on tables the migrator creates. It has no `CREATE`. An init script in `db/init`, mounted at `docker-entrypoint-initdb.d`, creates both roles. That script runs on an empty data directory. The skeleton's local volume is discarded with `docker compose down -v` before the first boot under this scheme.

Options:

1. **Three roles, as above** (accepted). A compromised request path cannot `DROP TABLE`.
2. **One `NOSUPERUSER` owner** for both migrations and requests. One fewer password. The app role can still drop the tables it owns.
3. **Keep the image superuser as the app role** and only require a strong password. Simplest, and it is the access the containers have today.

### Port and network

`db` has no `ports:` key in either Compose file. The API uses the hostname `db` on a Docker network named `db` with `internal: true`. Members of that network are `db` and `api`.

Web, MCP, and the Tailscale sidecars are on a separate `app` network. They reach the API there. They do not resolve `db`. The NAS file's fixed network name `cookbook` goes away, so another stack on the Unraid host is not attached to this database by name.

`psql` from the host is `docker compose exec db psql`. No localhost publish.

Options:

1. **Unpublished port, internal network shared only with the API** (accepted).
2. **Unpublished port, one network for every container.** A compromised web or MCP container can still connect to `db:5432`.
3. **Bind `127.0.0.1:5432` on the local file only.** Convenient for host `psql`, and it leaves a `ports:` key in the file.

### What the password does not do

The password stops a container or dependency that can open a TCP connection, and it stops a later Compose edit that publishes `5432` from exposing a database whose password is in the repo. It does not stop someone with a shell on the NAS, or someone who can read the data directory. Postgres does not encrypt that directory. Unraid disk encryption is the control for a disk that leaves the house.

The follow-up README text is:

* `$COOKBOOK_DATA_DIR/postgres` (the NAS bind mount; default `/mnt/user/appdata/cookbook/postgres`) is not an SMB or NFS share. After first start the Postgres image owns that directory. Do not chown it back to the Unraid account while the database is running. `.env` is mode `0600` and is not a share.
* Backups are `pg_dump` while Postgres is running, written somewhere with those same permissions. Copying `postgres/` is for a stopped database only, because a hot copy can be corrupt.
* Restores load a dump into an empty volume. Roles and passwords come from `.env` again.

## Automation after acceptance

* gitleaks stays inside `pnpm check`.
* `pnpm audit --audit-level=high` joins `pnpm check`.
* Dependabot version and security updates follow [0014](decisions/0014-supply-chain.md). That decision supersedes the earlier "security updates only, no weekly bump-all" wording.

Out of scope: Socket, Snyk, and a standing second review model.

## Supply chain

Accepted in [0014](decisions/0014-supply-chain.md). Detail is in [supply chain](supply-chain.md). Mention a line in the PR only when it is not true.

- A manifest or `packageManager` change updates the lockfile in the same PR.
- `allowBuilds` and `minimumReleaseAgeExclude` are unchanged.
- `audit.ignore` is unchanged.
- `pnpm audit --audit-level=high` is clean. A moderate advisory is named in the PR and does not fail CI.
- Actions this PR touches are full SHAs. `permissions` are unchanged, and a `pull_request` job does not gain a new one.
- Third-party image refs this PR touches include a digest. Postgres stays unpublished on the local file.
- `deploy/nas/docker-compose.yml` was left to the agent that owns it.
