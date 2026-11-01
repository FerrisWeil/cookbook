# Unraid production

Detail for [0015](decisions/0015-production.md). Database roles are in [security-review.md](security-review.md).

The accepted production file is not in the tree. The file that is in the tree is `deploy/nas/docker-compose.yml`. It builds on the NAS, publishes no host ports, uses one superuser password, advertises `tag:cookbook-web`, and mounts a Tailscale Serve config. In that skeleton, nginx listens on `127.0.0.1:80` and MCP binds `127.0.0.1`. The target below replaces that skeleton. When the production file is added, delete the skeleton so only one NAS Compose file remains.

## Deploy

One Compose Manager stack. Two paths, from a checkout that is not an SMB or NFS share:

- Compose file: `docker-compose.unraid.yml` at the repo root. Nginx and Tailscale config stay in `deploy/nas/`.
- Env file: `.env` beside that file. Every secret for every service. No second env file.

The stack name and UI label are whatever Taylor types in the Compose Manager screen. The repo does not store them. There is no `unraid/*.xml`.

```bash
docker compose --env-file .env -f docker-compose.unraid.yml up -d
```

There is no `up --build` on this path.

## Images

| Image | Who builds it |
| --- | --- |
| `ghcr.io/ferrisweil/cookbook-api` | This repo, on `master` |
| `ghcr.io/ferrisweil/cookbook-web` | This repo, on `master` |
| `ghcr.io/ferrisweil/cookbook-mcp` | This repo, on `master` |
| `postgres:16-alpine` | Upstream. Not `latest`. |
| `tailscale/tailscale:stable` | Upstream. |

`.github/workflows/docker.yml` is not in the tree. The target is separate from CI:

- Pull requests build `linux/amd64` and do not push.
- Pushes to `master`, and `workflow_dispatch`, build `linux/amd64` and push `latest` and `sha-<short>`.
- Login is `GITHUB_TOKEN` with `packages: write` on that job only. A `pull_request` job does not get that permission.

GitHub creates each package private on first push. `GITHUB_TOKEN` cannot change that. Before the NAS pull, set each package to Public:

- [cookbook-api](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-api)
- [cookbook-web](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-web)
- [cookbook-mcp](https://github.com/FerrisWeil/cookbook/pkgs/container/cookbook-mcp)

The NAS is a PC running Unraid. Publish `linux/amd64` only. The images contain no secrets and no recipes.

## Compose target

`docker-compose.unraid.yml` has no `build:` key and no `ports:` key. `COOKBOOK_IMAGE_TAG` has no default (`${COOKBOOK_IMAGE_TAG:?}`). All three app images use it.

| Service | Image | Network |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | `db` only (`internal: true`) |
| `api` | cookbook-api | `db` and `app` |
| `web-tailscale` | `tailscale/tailscale:stable` | `app` |
| `web` | cookbook-web | `network_mode: service:web-tailscale` |
| `mcp-tailscale` | `tailscale/tailscale:stable` | `app` |
| `mcp` | cookbook-mcp | `network_mode: service:mcp-tailscale` |

Postgres passwords and roles are the three values in the security doc. No dev password in this file. The `db` healthcheck is `pg_isready -U postgres -d cookbook`.

Nginx and Tailscale config mounts are `./deploy/nas/nginx.conf` and `./deploy/nas/tailscale`. On this target, nginx listens on `0.0.0.0:80` and MCP `BIND_HOST` is `0.0.0.0`. The skeleton's loopback bind was only for Serve. Init runs only on an empty data directory. If `postgres/` already exists from the skeleton, stop the stack and rename that directory before the first boot.

## Tailscale

Serve is off. Funnel is off. No port 443 grant. API and Postgres are not tailnet nodes.

| Node | Hostname | Tag | Who can connect | Port |
| --- | --- | --- | --- | --- |
| Web | `cookbook` | `tag:cookbook` | Family devices already on the tailnet | `tcp:80` |
| MCP | `cookbook-mcp` | `tag:cookbook-mcp` | `tag:bot` | `tcp:8787` |

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

`autogroup:member` stands in for family devices. Merge the fragment into the tailnet policy. Do not replace the whole file.

Web and MCP listen on `0.0.0.0` inside the sidecar network namespace. That bind is the tailnet address, not a host port. The Unraid host can still open the Docker bridge address. The app network has no fixed global `name:`.

Two auth keys, reusable, not ephemeral, and pre-authorized if the tailnet requires approval. One tag each. They live only in the NAS env file.

Health on the tailnet: `http://cookbook/` and `http://cookbook-mcp:8787/health`. MCP calls still need the bearer token.

`http://cookbook/` is not a secure context. The installable app does not install from that URL until a later ADR turns Serve on.

## Data and backups

`COOKBOOK_DATA_DIR` defaults to `/mnt/user/appdata/cookbook`. The directory is not an SMB or NFS share. `.env` next to the compose file is mode `0600` and is not mounted into a container.

| Path | Contents |
| --- | --- |
| `postgres/` | Database files. The image owns this after first start. |
| `tailscale-web/` | Web node state |
| `tailscale-mcp/` | MCP node state |
| `backups/` | Dump files |

Dump while Postgres is running. Write a partial file and move it into place only after `pg_dump` exits 0, so a failed dump does not erase the previous one.

```bash
dump="$COOKBOOK_DATA_DIR/backups/cookbook.dump"
tmp="${dump}.partial"
docker compose --env-file .env \
  -f docker-compose.unraid.yml exec -T -u postgres db \
  pg_dump -d cookbook -Fc > "$tmp"
mv "$tmp" "$dump"
chmod 600 "$dump"
```

That uses the socket inside the `db` container. It does not publish `5432`. Restore: rename `postgres/` aside, start only `db` so init creates the roles, then `pg_restore` into that empty database. Passwords come from `.env` again. Starting the API before the dump loads lets it migrate an empty database and then collide with the dump. Copy `postgres/` only when the database is stopped. An appdata backup of the whole directory is a consistent copy only when the stack is stopped.

Copying `tailscale-web/` and `tailscale-mcp/` while the stack is up is fine. Those directories are not in the SQL dump.

## Update and rollback

Steady state pins `COOKBOOK_IMAGE_TAG` to a `sha-` tag. `.env.example` may contain `latest` so the first pull has something to fetch. Replace that with the sha from the Actions run that published it.

1. Dump the database.
2. Set `COOKBOOK_IMAGE_TAG` in `.env` to the new `sha-` tag.
3. `docker compose --env-file .env -f docker-compose.unraid.yml pull api web mcp`
4. `docker compose --env-file .env -f docker-compose.unraid.yml up -d api web mcp`
5. Check `http://cookbook/` and `http://cookbook-mcp:8787/health` from a tailnet device.

Rollback is steps 2–5 with the previous sha. If the old API will not boot because a migration ran, restore the dump into an empty `postgres/` directory. There is no down migration.

No Watchtower. Naming `api`, `web`, and `mcp` keeps a sha bump from also moving `postgres:16-alpine` or `tailscale/tailscale:stable`. Changing those two images is an edit to the compose file, and it gets a dump first.
