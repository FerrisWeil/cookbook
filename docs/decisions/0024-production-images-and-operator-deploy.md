# 0024. Production images and operator deploy

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

Production still compiles on the NAS. [0015](0015-production.md) already chose pulled images, one stack, sidecars, a pinned tag after a dump, and logical backups. The remaining calls are where those images live, whether they are signed, how the production file differs from local, where secrets live, and how an operator updates and rolls back.

## Options considered

1. **GitHub Container Registry, public packages, no signing** — same host as the public repo. Images hold no secrets or recipes. No pull token on the NAS. No signing key to keep.
2. **A second registry** — Docker Hub is another account. A registry on the NAS is another service to run.
3. **Private packages and a pull token** — the NAS authenticates to GitHub. A leaked token reads every private package that token can see.
4. **Sign images** — a verifier on the NAS, and a key to rotate, for images that already contain no secrets.
5. **Digest-pin third-party images in the production file** — the same pin rule as local compose ([0014](0014-supply-chain.md)).
6. **Leave third-party tags floating** — easier bumps, a mutable tag on the only recipe database.
7. **Production compose pulls and does not build; Serve stays off** — listeners bind inside each sidecar namespace so the tailnet address answers. Loopback-plus-Serve needs certificates first ([0002](0002-tailscale-only.md)).
8. **Keep Serve on** — tailnet HTTPS now, which 0002 deferred.
9. **Bake Tailscale into the app images** — drops the sidecar, and a new Tailscale release rebuilds the app.
10. **One env file beside the compose file** — every secret, not in git, not in the data directory, not mounted into a container ([0007](0007-public-repo-secrets.md), [0015](0015-production.md)).
11. **Secrets in the data directory or in Unraid templates** — a share or a template can leak them.
12. **API applies forward migrations on boot** — already [0010](0010-migration-tooling.md). No migrate job. No down migrations.
13. **A separate migrate container** — another NAS container, which is an ADR ([0012](0012-parallel-agents.md)).
14. **Operator logical dumps, including before every update; no scheduled job in this repo** — the dump is the backup. A cron in git would run unattended against the only copy.
15. **Unraid appdata backup as the only backup** — a copy of a running database can be corrupt.
16. **Rollback is the previous pin; a schema rollback is a dump restore** — no down migrations.

## Decision

CI publishes the three app images to GitHub Container Registry. Pull requests build the NAS architecture and do not publish. A merge to the default branch publishes a moving tag and an immutable commit tag. Packages are public. Images contain no secrets and no recipes. Images are not signed. The pin is the commit tag. Third-party images in the production file are digest-pinned.

The production compose file pulls those images. It does not build. It publishes no host ports and has no secret defaults. Tailscale stays in sidecars. Serve stays off. Funnel stays off. Listeners bind inside the sidecar network namespace so the tailnet address answers. The API and the database are not tailnet nodes. The web app and MCP reach the API on the stack network, not over the tailnet. MCP stays off the database network ([0021](0021-mcp-recipe-tools.md)).

Unraid runs one Compose Manager stack. The operator points it at the production compose file and one env file beside it. The NAS does not compile. An update is an operator pull of a new pin after a dump. No automatic puller.

Secrets live in that one env file. It is not in git, not in the data directory, and not mounted into a container. No default secret. Local may use documented non-secret tokens that are not valid on the NAS.

The API applies forward migrations on boot. MCP does not migrate. There are no down migrations.

Backups are operator-taken logical dumps of the running database. A dump includes a hidden recipe. This repo does not add a scheduled dump job.

Rollback is the previous pin. If a migration already ran, restore the dump into an empty data directory.

## Consequences

* Taylor sets each package public after the first publish. Until then the NAS cannot pull.
* A public package can be pulled by anyone. That is acceptable because the images hold no family data.
* Digest pins on third-party images mean a bump is a compose edit, and it gets a dump first.
* Database roles and the unpublished database stay [0013](0013-security-review.md). Caller tokens stay [0021](0021-mcp-recipe-tools.md). This decision does not add a container.
* Names, tags, mounts, and the operator steps are in the Unraid doc. Pins are in the supply-chain doc.
