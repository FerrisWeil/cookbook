# 0016. Publish images to GHCR

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

Nothing is published to GHCR from this repo yet. The feature PR adds the workflow.

## Context

The NAS should not compile the app ([0017](0017-production-compose.md)). nas-mcp already publishes `ghcr.io/ferrisweil/nas-mcp` from GitHub Actions and tells the owner to flip the package to public by hand. This repo is public ([0007](0007-public-repo-secrets.md)). Detail, image names, and the visibility step are in [unraid production](../unraid-production.md).

## Options considered

1. **GitHub Actions pushes linux/amd64 images to GHCR on `master`.** `GITHUB_TOKEN` with `packages: write`. Tags `latest` and `sha-<short>`. Pull requests build and do not push. Taylor sets each package **public** in the GitHub UI after the first publish. Recommended.
2. **Also publish linux/arm64.** nas-mcp does this. These images are Node builds, and QEMU arm64 makes CI slow. The NAS is a PC running Unraid, not an Apple Silicon machine, so this build is unused.
3. **Build on the NAS, or push to Docker Hub.** Building on the NAS is the skeleton's current command. Docker Hub is a second account. GHCR is the registry nas-mcp already uses.

## Decision

Use option 1. Taylor confirmed the NAS is a PC running Unraid, so the images are linux/amd64 only. Three images, one workflow file `.github/workflows/docker.yml`, separate from CI:

* `ghcr.io/ferrisweil/cookbook-api`
* `ghcr.io/ferrisweil/cookbook-web`
* `ghcr.io/ferrisweil/cookbook-mcp`

Postgres and Tailscale stay the upstream images named in [0017](0017-production-compose.md) and [0018](0018-tailscale-sidecars.md). They are not built here.

Actions cannot mark a package public with `GITHUB_TOKEN`. GitHub creates each package private on first push. The setup guide must say, before any pull, that Taylor opens each package and sets visibility to Public. Until he does, Unraid pulls fail.

## Consequences

* The first `latest` tag exists only after this workflow has succeeded on `master`.
* `ci.yml` stays `pnpm check` and `pnpm smoke` ([0009](0009-repo-layout.md)).
* A private package is not a backup auth scheme. The images contain no secrets and no recipes.
