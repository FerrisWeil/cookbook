# 0015. Publish images to GHCR

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Nothing is published to GHCR from this repo yet.

## Context

The NAS should not compile the app ([0016](0016-production-compose.md)). nas-mcp already publishes `ghcr.io/ferrisweil/nas-mcp` from GitHub Actions and tells the owner to flip the package to public by hand. This repo is public ([0007](0007-public-repo-secrets.md)). Detail, image names, and the visibility step are in [unraid production](../unraid-production.md).

## Options considered

1. **GitHub Actions pushes linux/amd64 images to GHCR on `main`.** `GITHUB_TOKEN` with `packages: write`. Tags `latest` and `sha-<short>`. Pull requests build and do not push. Taylor sets each package **public** in the GitHub UI after the first publish. Recommended.
2. **Also publish linux/arm64.** nas-mcp does this. These images are Node builds, and QEMU arm64 makes CI slow. Choose this if the NAS is ARM.
3. **Build on the NAS, or push to Docker Hub.** Building on the NAS is the skeleton's current command. Docker Hub is a second account. GHCR is the registry nas-mcp already uses.

## Decision (proposed)

Use option 1 unless Taylor says the NAS is ARM. In that case use option 2 (publish amd64 and arm64) and do not leave amd64 as a silent default. Three images, one workflow file `.github/workflows/docker.yml`, separate from CI:

* `ghcr.io/ferrisweil/cookbook-api`
* `ghcr.io/ferrisweil/cookbook-web`
* `ghcr.io/ferrisweil/cookbook-mcp`

Postgres and Tailscale stay the upstream images named in [0016](0016-production-compose.md) and [0017](0017-tailscale-sidecars.md). They are not built here.

Actions cannot mark a package public with `GITHUB_TOKEN`. GitHub creates each package private on first push. The setup guide must say, before any pull, that Taylor opens each package and sets visibility to Public. Until he does, Unraid pulls fail.

## Consequences (if accepted)

* The first `latest` tag exists only after this workflow has succeeded on `main`.
* `ci.yml` stays `pnpm check` and `pnpm smoke` ([0009](0009-repo-layout.md)).
* A private package is not a backup auth scheme. The images contain no secrets and no recipes.
