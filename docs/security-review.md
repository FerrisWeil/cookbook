# Security review

Taylor confirmed (2026-10-26, agent chat) that every pull request fills this checklist now. [0013](decisions/0013-security-review.md) may still say proposed. Leave Compose changes to that ADR.

Every pull request fills the checklist below in the PR body before the PR is marked ready. Docs-only PRs fill it too. Each item names a path or pastes the command output that shows the result. `n/a` is allowed only together with the files that were opened. Taylor confirms the filled checklist is enough. There is no second review bot.

## Dependencies

- New or updated direct dependencies, and why this PR needs them.
- Who maintains each one, and whether it is abandoned.
- Install scripts. `pnpm-workspace.yaml` `allowBuilds` is the gate. Today the only entry is `esbuild`.
- `pnpm audit --audit-level=high` result. High severity fails CI once this ADR is accepted. Moderate findings are listed here and do not fail CI.

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
- Read the local Compose file and `deploy/nas/docker-compose.yml` separately.

## Data and logging

- Logs, errors, fixtures, and screenshots contain no recipes, notes, or tokens.

## Postgres

Proposed baseline, checked against both Compose files once [0013](decisions/0013-security-review.md) is accepted. Not applied yet.

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

1. **Three roles, as above** (proposed). A compromised request path cannot `DROP TABLE`.
2. **One `NOSUPERUSER` owner** for both migrations and requests. One fewer password. The app role can still drop the tables it owns.
3. **Keep the image superuser as the app role** and only require a strong password. Simplest, and it is the access the containers have today.

### Port and network

`db` has no `ports:` key in either Compose file. The API uses the hostname `db` on a Docker network named `db` with `internal: true`. Members of that network are `db` and `api`.

Web, MCP, and the Tailscale sidecars are on a separate `app` network. They reach the API there. They do not resolve `db`. The NAS file's fixed network name `cookbook` goes away, so another stack on the Unraid host is not attached to this database by name.

`psql` from the host is `docker compose exec db psql`. No localhost publish.

Options:

1. **Unpublished port, internal network shared only with the API** (proposed).
2. **Unpublished port, one network for every container.** A compromised web or MCP container can still connect to `db:5432`.
3. **Bind `127.0.0.1:5432` on the local file only.** Convenient for host `psql`, and it leaves a `ports:` key in the file.

### What the password does not do

The password stops a container or dependency that can open a TCP connection, and it stops a later Compose edit that publishes `5432` from exposing a database whose password is in the repo. It does not stop someone with a shell on the NAS, or someone who can read the data directory. Postgres does not encrypt that directory. Unraid disk encryption is the control for a disk that leaves the house.

When this is accepted, the README will say:

* `data/postgres` (the NAS bind mount) is mode `0700`, owned by the account that runs Docker, and is not an SMB or NFS share. `.env` is mode `0600` in the same way.
* Backups are `pg_dump` while Postgres is running, written somewhere with those same permissions. Copying `data/postgres` is for a stopped database only, because a hot copy can be corrupt.
* Restores load a dump into an empty volume. Roles and passwords come from `.env` again.

## Automation after acceptance

* gitleaks stays inside `pnpm check`.
* `pnpm audit --audit-level=high` joins `pnpm check`.
* Dependabot security updates only, for npm, GitHub Actions, and Docker. No weekly bump-all.

Out of scope: Socket, Snyk, and a standing second review model.
