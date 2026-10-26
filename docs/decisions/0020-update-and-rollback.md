# 0020. Update and rollback

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

Nothing pulls new images on a timer. The feature PR does not add a scheduler.

## Context

[0016](0016-ghcr-images.md) publishes `latest` and `sha-<short>` together. [0010](0010-migration-tooling.md) applies SQL forward on API startup and has no down migration. A household recipe database should not move because `master` moved. Detail is in [unraid production](../unraid-production.md).

## Options considered

1. **Pin `COOKBOOK_IMAGE_TAG` to a `sha-<short>` tag. Update and roll back by editing that pin.** Dump the database first. One tag for the API, web, and MCP images. Recommended.
2. **Track `latest`.** Fewer edits. The next `docker compose pull` takes whatever `master` last published, including a bad build.
3. **Watchtower or another auto-puller.** Unattended upgrades on the only copy of the recipes.

## Decision

Use option 1. The env file sets the tag. There is no default in the compose file, so a missing tag fails closed. The example file may contain `latest` so the first pull works before a sha exists. The setup guide's last step replaces that with the sha from the Actions run that just published.

Update: `pg_dump` ([0019](0019-data-dir-and-backups.md)), set the new sha, `docker compose pull api web mcp`, `docker compose up -d` those three services, then check health on the tailnet. Rollback: set the previous sha and `up -d` the same three. If the old image will not start because a migration already ran, `pg_restore` the pre-update dump into an empty data directory. Do not add down migrations here. Pulling every service would also move `postgres:16-alpine` and `tailscale/tailscale:stable`.

`postgres:16-alpine` and `tailscale/tailscale:stable` are not this tag. Moving them is an edit to the compose file, and it gets a dump first.

## Consequences

* No Watchtower container, and no Unraid auto-update on these three images.
* Rollback of the app is a tag change. Rollback of the schema is a dump restore.
* The feature PR does not add a scheduler. Taylor runs the commands when he wants the new sha.
