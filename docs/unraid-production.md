# Unraid production stack

Accepted detail for [0014](decisions/0014-unraid-compose-manager.md) through [0019](decisions/0019-update-and-rollback.md). Taylor confirmed this in chat on 2026-10-26, including a repo-root Unraid file and linux/amd64 only. The skeleton under `deploy/nas/` still builds on the NAS and still turns on Tailscale Serve until the feature PR.

nas-mcp is the reference for the registry workflow, the manual public-package step, and tags shaped like `tag:nas-mcp`: [FerrisWeil/nas-mcp](https://github.com/FerrisWeil/nas-mcp). It is not the template to copy. That repo is one container. This one is not.

## Deploy (0014)

Taylor already runs Unraid's Compose Manager. One stack is the whole app. In that stack's settings he sets two paths, from a checkout that is not an SMB or NFS share:

* Compose file: `docker-compose.unraid.yml` at the repo root. Nginx and Tailscale config stay in `deploy/nas/`.
* Env file: `.env` in that same directory. Every secret for every service goes in this file. Compose Manager does not get a second env file.

The stack name and UI label are whatever he types in that screen. The repo does not store them.

SSH, from the repo root, uses the same pair:

```bash
docker compose --env-file .env -f docker-compose.unraid.yml up -d
```

There is no `up --build` on this path, and no `unraid/*.xml` in this repo.

## Images (0015)

| Image | Who builds it |
| --- | --- |
| `ghcr.io/ferrisweil/cookbook-api` | This repo, on `main` |
| `ghcr.io/ferrisweil/cookbook-web` | This repo, on `main` |
| `ghcr.io/ferrisweil/cookbook-mcp` | This repo, on `main` |
| `postgres:16-alpine` | Upstream. Not `latest`. |
| `tailscale/tailscale:stable` | Upstream. |

`.github/workflows/docker.yml` (not `ci.yml`):

* Pull requests build `linux/amd64` and do not push.
* Pushes to `main`, and `workflow_dispatch`, build `linux/amd64` and push `latest` and `sha-<short>` (the short git SHA).
* Login is `GITHUB_TOKEN` with `packages: write` on that job.
* A pull request does not cancel a `main` publish that is already running.

### Package visibility is a manual step

GitHub creates each package **private** the first time Actions pushes it. `GITHUB_TOKEN` cannot change that. Unraid will fail the pull until Taylor sets each package to **Public**.

Do this once per package, after the first green Docker run on `main`, and before the NAS pull:

1. Open the repo Packages list, or the direct page after it exists:
   * [cookbook-api](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-api)
   * [cookbook-web](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-web)
   * [cookbook-mcp](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-mcp)
2. Package settings → Change visibility → Public → type the package name to confirm.
3. `docker pull ghcr.io/ferrisweil/cookbook-api:latest` with no token, from any machine, including the Unraid terminal.

The feature guide (`docs/unraid-setup.md`) leads with this section. A private package is not how the NAS authenticates.

The NAS is a PC running Unraid, not an Apple Silicon machine. Publish linux/amd64 only.

## Production Compose (0016)

One Unraid file: `docker-compose.unraid.yml` at the repo root. `docker-compose.yml` stays the dev stack. No `build:` key. No `ports:` key. No fixed network `name:`. The feature PR deletes `deploy/nas/docker-compose.yml`. Mounts that used to be `./nginx.conf` and `./tailscale` become `./deploy/nas/nginx.conf` and `./deploy/nas/tailscale`, because the compose file moved and those files did not.

`COOKBOOK_IMAGE_TAG` has no default in the file (`${COOKBOOK_IMAGE_TAG:?...}`). All three app images use it, so they stay on one commit.

Services:

| Service | Image | Network |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | `db` only (`internal: true`) |
| `api` | cookbook-api | `db` and `app` |
| `web-tailscale` | `tailscale/tailscale:stable` | `app` |
| `web` | cookbook-web | `network_mode: service:web-tailscale` |
| `mcp-tailscale` | `tailscale/tailscale:stable` | `app` |
| `mcp` | cookbook-mcp | `network_mode: service:mcp-tailscale` |

Postgres, matching [0013](decisions/0013-security-review.md) and [security review](security-review.md):

* The image superuser is the role `postgres`: `POSTGRES_USER=postgres` and `POSTGRES_PASSWORD` is `${POSTGRES_SUPERUSER_PASSWORD:?}`. App containers do not receive that password.
* `POSTGRES_MIGRATOR_PASSWORD` and `POSTGRES_APP_PASSWORD` are also `${VAR:?}`. The file does not contain the dev password.
* `db/init` is a shell script mounted into `docker-entrypoint-initdb.d`, not a `.sql` file. The Postgres image runs `.sql` through `psql` with no environment substitution, so a SQL file cannot see the passwords. The `db` service receives `POSTGRES_MIGRATOR_PASSWORD` and `POSTGRES_APP_PASSWORD` for that script. The script creates `cookbook_migrator` (no superuser) and `cookbook_app` (DML only), runs `ALTER DATABASE cookbook OWNER TO cookbook_migrator`, and sets `ALTER DEFAULT PRIVILEGES FOR ROLE cookbook_migrator` so later tables the migrator creates are usable by `cookbook_app`. The image's first-boot database would otherwise stay owned by `postgres`. The superuser is init-only. App containers still do not receive the superuser password.
* The API uses the migrator role while migrating and seeding, then the app role for requests, when those two passwords are set. When they are absent, it keeps the current single-password path so the root compose file still starts with no env file.

The feature PR does not edit the dev compose file. [0013](decisions/0013-security-review.md) still wants that file locked down. Taylor left that as its own follow-up.

Init SQL runs on an empty data directory only. If `postgres/` already exists from the skeleton, stop the stack and rename the directory before the first boot of this file.

## Tailscale (0017)

Exposed nodes are the web app and the MCP server. Each has its own sidecar, its own auth key, and its own tag. API and Postgres are not nodes.

| Node | Hostname | Tag | Who can connect | Port |
| --- | --- | --- | --- | --- |
| Web | `cookbook` | `tag:cookbook` | Family devices already on the tailnet | `tcp:80` |
| MCP | `cookbook-mcp` | `tag:cookbook-mcp` | `tag:bot` | `tcp:8787` |

Tags match the hostnames, same shape as `tag:nas-mcp`. `tag:bot` is the existing bot tag. Bots do not get the web node. Family devices do not get the MCP port from this grant. Merge the fragment into the tailnet policy. Do not replace the whole file.

```json
{
  "tagOwners": {
    "tag:cookbook": ["autogroup:admin"],
    "tag:cookbook-mcp": ["autogroup:admin"],
    "tag:bot": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["autogroup:member"],
      "dst": ["tag:cookbook"],
      "ip": ["tcp:80"]
    },
    {
      "src": ["tag:bot"],
      "dst": ["tag:cookbook-mcp"],
      "ip": ["tcp:8787"]
    }
  ]
}
```

`autogroup:member` is the stand-in for family devices. Narrow the `src` if the tailnet has members who should not browse recipes.

No Serve, no Funnel, no port 443 grant. Web and MCP listen on `0.0.0.0` inside the sidecar network namespace. Compose publishes no host ports, so that bind is the tailnet address, not the LAN. The Unraid host can still open the Docker bridge address. That residual path is accepted, as it is for nas-mcp. The app network is not given a global `name:`, so another stack does not join it by name.

Auth keys are reusable, not ephemeral, and pre-authorized if the tailnet requires approval. One key advertises `tag:cookbook`, the other `tag:cookbook-mcp`. They go in the env file only.

Health on the tailnet, after the feature is up: `http://cookbook/` and `http://cookbook-mcp:8787/health`. MCP calls still need the bearer token ([0003](decisions/0003-mcp-bearer-token.md)).

## Data, backups, permissions (0018)

`COOKBOOK_DATA_DIR` defaults to `/mnt/user/appdata/cookbook`. The directory is not an SMB or NFS share. `.env` next to the compose file is mode `0600` and is not mounted into a container.

| Path | Contents |
| --- | --- |
| `postgres/` | Database files. The image owns this after first start. |
| `tailscale-web/` | Web node state |
| `tailscale-mcp/` | MCP node state |
| `backups/` | Dump files |

Supported backup, while Postgres is running, written from the repo root on the Unraid shell. Write to a new file and replace the previous dump only after `pg_dump` exits 0, so a failed dump does not truncate the last good copy:

```bash
dump="$COOKBOOK_DATA_DIR/backups/cookbook.dump"
tmp="${dump}.partial"
docker compose --env-file .env \
  -f docker-compose.unraid.yml exec -T -u postgres db \
  pg_dump -d cookbook -Fc > "$tmp"
mv "$tmp" "$dump"
chmod 600 "$dump"
```

That uses the socket inside the `db` container. It does not publish `5432`. The file is custom format. Restore it with `pg_restore`, not `psql`. The feature PR confirms both commands against `postgres:16-alpine` before the guide calls them done.

Restore: rename `postgres/` aside, start only `db` so init creates the roles, `pg_restore` into that empty database, then start the rest of the stack. Passwords come from `.env` again. Starting the API before the dump loads lets it migrate an empty database and then collide with the dump. Copying `postgres/` is for a stopped database only. An Unraid appdata backup of the whole directory is optional, and it is consistent only when the stack is stopped.

Copying `tailscale-web/` and `tailscale-mcp/` while the stack is up is fine. Those directories are not in the SQL dump. Losing one means a new login with that node's auth key.

## Update and rollback (0019)

Steady state pins `COOKBOOK_IMAGE_TAG` to a `sha-` tag. The example file uses `latest` only so the first pull has something to fetch. The guide then tells Taylor to replace it with the sha from that Actions run.

Update:

1. Dump the database (above), from the repo root.
2. Set `COOKBOOK_IMAGE_TAG` in `.env` to the new `sha-` tag.
3. `docker compose --env-file .env -f docker-compose.unraid.yml pull api web mcp`
4. `docker compose --env-file .env -f docker-compose.unraid.yml up -d api web mcp`
5. Check `http://cookbook/` and `http://cookbook-mcp:8787/health` from a tailnet device.

Rollback is steps 2–5 with the previous sha. If the old API will not boot because a migration ran, restore the dump from step 1 into an empty `postgres/` directory. There is no down migration ([0010](decisions/0010-migration-tooling.md)).

No Watchtower. `pull` and `up` name `api`, `web`, and `mcp` so a routine sha bump does not also move `postgres:16-alpine` or `tailscale/tailscale:stable`. Changing those two images is an edit to the compose file, and it gets a dump first. The `db` healthcheck is `pg_isready -U postgres -d cookbook`. The API image keeps the `HEALTHCHECK` in its Dockerfile so Compose can wait on `service_healthy`.

## Feature PR

Start it after this ADR pull request is merged. No Playwright in that PR. Taylor confirms the stack by running it before any browser tests ([0011](decisions/0011-test-tooling.md)).

That PR adds:

* `docker-compose.unraid.yml` at the repo root, as described above, including `TS_EXTRA_ARGS`, no `TS_SERVE_CONFIG`, and a `db` healthcheck of `pg_isready -U postgres -d cookbook`. Delete `deploy/nas/docker-compose.yml`.
* `deploy/nas/nginx.conf` listening on `0.0.0.0:80`, and MCP `BIND_HOST=0.0.0.0`
* `db/init` as a shell script, and the API's two-password path
* The root `.env.example` is the only example. It lists every key that one `.env` needs. Local compose still starts without it. Later features append keys ([0012](decisions/0012-parallel-agents.md)).
* `.github/workflows/docker.yml`
* `docs/unraid-setup.md`, leading with the public-package step
* `features/unraid-production/feature.md`

`pnpm smoke` renders `docker-compose.unraid.yml` with dummy values and does not start Tailscale or that project. The rendered config must name the three `ghcr.io/ferrisweil/cookbook-*` images and `BIND_HOST: 0.0.0.0` for MCP, and must not contain a published port, a `build:` key, `MCP_ALLOW_DEV_TOKEN`, `TS_SERVE_CONFIG`, or `:-cookbook`. It must not still require `BIND_HOST: 127.0.0.1`. `pnpm check` runs a `node:test` that reads that compose file, `deploy/nas/nginx.conf`, and the workflow file and fails on the same mistakes. The test does not run Docker or Tailscale.

## Confirmed

Taylor, 2026-10-26, agent chat. Compose Manager, GHCR linux/amd64, the Postgres rules, the Tailscale tags with Serve deferred, the data directory, and sha pins. The Unraid compose file is `docker-compose.unraid.yml` at the repo root. The dev file stays `docker-compose.yml`. One Compose Manager stack, one `.env` beside that compose file, and the UI label is set in Unraid.
