#!/usr/bin/env bash
# Idempotent dependency install. Docker, Node, and pnpm come from the image.
set -euo pipefail

cd /workspace
command -v pnpm >/dev/null
command -v docker >/dev/null
pnpm install --frozen-lockfile
