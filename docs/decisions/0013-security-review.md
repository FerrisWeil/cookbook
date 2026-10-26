# 0013. Security review and Postgres access

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26, agent chat (merged means accepted; foundation PR #1 merged 2026-10-26)

The checklist is in force. Compose roles, `pnpm audit`, Dependabot, and the PR-template checklist are named follow-up and are not in the tree yet.

## Context

The app will run on Taylor's Unraid NAS and hold recipes, notes, and tokens ([0002](0002-tailscale-only.md), [0007](0007-public-repo-secrets.md)). Taylor will not audit every package himself. Every PR needs a short security review he can confirm.

Postgres is part of that review. Today the local Compose file publishes `5432` and falls back to the password `cookbook`. Both Compose files connect the API as `cookbook`, which the Postgres image creates as a superuser. On the NAS file the database, API, and both Tailscale sidecars share one network named `cookbook`. The NAS file already publishes no host ports.

The checklist and the Compose shape are in [security review](../security-review.md).

## Options considered

1. **A PR checklist Taylor confirms, plus a locked-down Postgres.** The agent fills [security review](../security-review.md) on every PR, with paths or command output. Postgres takes a random password from `.env`, publishes no port, sits on a network with only the API, and the app connects as a role that cannot change the schema. Recommended.
2. **An external scanner (Socket, Snyk, or a second review bot).** Extra account and noise for one private household server. gitleaks plus `pnpm audit` cover the automated slice.
3. **Password only.** Keep one superuser and one shared network, and stop publishing `5432`. A compromised web or MCP container can still open a connection to the database.
4. **Publish Postgres on `127.0.0.1` for local `psql`.** The NAS stays closed. It trains the Compose file to have a `ports:` key, which is the mistake a later edit can widen to every interface. `docker compose exec` reaches `psql` without a published port.

## Decision

Use option 1.

Every PR, including docs-only, gets the checklist in [security review](../security-review.md) before it is marked ready. Taylor confirms the filled checklist is enough. Automated checks stay gitleaks, plus `pnpm audit --audit-level=high` inside `pnpm check`. Dependabot opens security updates only, for npm, GitHub Actions, and Docker.

Postgres, on the local file and the NAS file:

* A strong random password comes from the gitignored env file. `.env.example` keeps placeholders. Compose has no default password.
* The database port is not published. Clients use the Docker DNS name `db`.
* The database network is `internal` and has two members: `db` and `api`. Web and MCP are on the app network only.
* The API serves requests as `cookbook_app` (no superuser, no DDL). It applies migrations as `cookbook_migrator`, then closes that connection. The image superuser is init-only.
* Backups and the permissions on `$COOKBOOK_DATA_DIR/postgres` and `.env` are documented beside the password, because a password does not protect files on disk or a shell on the NAS. The Postgres image owns that directory after first start.

[0012](0012-parallel-agents.md) still gives each local run its own Compose project and its own volume. That proposal's published ports are the web, API, and MCP ports only.

## Consequences

* Follow-up edits both Compose files, adds a `db/init` shell script that runs the role SQL (a `.sql` file cannot see the passwords), splits the API into two connection strings, replaces the single `POSTGRES_PASSWORD` placeholder with three, and documents backup and directory mode. Local volumes created by the skeleton are removed with `docker compose down -v` before that first boot. There is no production data yet.
* The same follow-up adds the checklist to the PR template and a pointer in CONTRIBUTING, adds `pnpm audit --audit-level=high` to `pnpm check`, and adds Dependabot security-only config. Moderate advisories are called out on the checklist and do not fail CI.
* This cloud VM's Docker bridge does not forward container to container, which is why the local file currently publishes `5432`. GitHub CI and Unraid do forward it. After acceptance, smoke on this VM can fail for that reason. The database port stays unpublished anyway.
* Does not change [0008](0008-typescript-stack.md), [0010](0010-migration-tooling.md), [0011](0011-test-tooling.md), or [0012](0012-parallel-agents.md). Those are accepted on their own terms.
