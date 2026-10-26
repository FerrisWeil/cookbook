# Security review

Checklist for [0013](decisions/0013-security-review.md). Status is **accepted** (2026-10-26, merged means accepted). Fill this on every PR before it is marked ready. The Compose role split, `pnpm audit` in `pnpm check`, Dependabot, and the PR-template copy of this list are still follow-up. They are not in the tree yet.

Every pull request fills the checklist below in the PR body before the PR is marked ready. Docs-only PRs fill it too. Each item names a path or pastes the command output that shows the result. `n/a` is allowed only together with the files that were opened. Taylor confirms the filled checklist is enough. There is no second review bot.

## Dependencies

- New or updated direct dependencies, and why this PR needs them.
- Who maintains each one, and whether it is abandoned.
- Install scripts. `pnpm-workspace.yaml` `allowBuilds` is the gate. Today the only entry is `esbuild`.
- `pnpm audit --audit-level=high` result. High severity fails CI once the follow-up adds it to `pnpm check`. Until then, paste the command output here. Moderate findings are listed here and do not fail CI.

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
- Read the local Compose file and the Unraid file separately. The Unraid file is `docker-compose.unraid.yml` once [0016](decisions/0016-production-compose.md) is implemented. Until then it is still `deploy/nas/docker-compose.yml`.

## Data and logging

- Logs, errors, fixtures, and screenshots contain no recipes, notes, or tokens.

## Postgres

Accepted baseline. Checked against both Compose files once the follow-up lands. Not applied to the Compose files yet.

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
* Dependabot security updates only, for npm, GitHub Actions, and Docker. No weekly bump-all.

Out of scope: Socket, Snyk, and a standing second review model.
