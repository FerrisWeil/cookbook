#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version=8.30.0
os=$(uname -s | tr '[:upper:]' '[:lower:]')
machine=$(uname -m)
case "$machine" in
  x86_64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *)
    echo "unsupported architecture: $machine" >&2
    exit 1
    ;;
esac
case "$os" in
  linux | darwin) ;;
  *)
    echo "unsupported os: $os" >&2
    exit 1
    ;;
esac

cache="${TMPDIR:-/tmp}/cookbook-gitleaks-${version}-${os}-${arch}"
bin="$cache/gitleaks"
if [[ ! -x "$bin" ]]; then
  mkdir -p "$cache"
  url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${os}_${arch}.tar.gz"
  curl -sSfL "$url" | tar -xz -C "$cache" gitleaks
  chmod +x "$bin"
fi

"$bin" detect --source . --no-banner --redact --exit-code 1
