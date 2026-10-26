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

# SHA-256 from the v8.30.0 release checksums file, checked against the tarballs.
expected_checksum() {
  case "$1" in
    linux_x64) echo "79a3ab579b53f71efd634f3aaf7e04a0fa0cf206b7ed434638d1547a2470a66e" ;;
    linux_arm64) echo "b4cbbb6ddf7d1b2a603088cd03a4e3f7ce48ee7fd449b51f7de6ee2906f5fa2f" ;;
    darwin_x64) echo "ca221d012d247080c2f6f61f4b7a83bffa2453806b0c195c795bbe9a8c775ed5" ;;
    darwin_arm64) echo "b251ab2bcd4cd8ba9e56ff37698c033ebf38582b477d21ebd86586d927cf87e7" ;;
    *)
      echo "no gitleaks checksum for $1" >&2
      return 1
      ;;
  esac
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

cache="${TMPDIR:-/tmp}/cookbook-gitleaks-${version}-${os}-${arch}"
bin="$cache/gitleaks"
if [[ ! -x "$bin" ]]; then
  mkdir -p "$cache"
  url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${os}_${arch}.tar.gz"
  tarball="$cache/gitleaks.tar.gz"
  curl -fsSL "$url" -o "$tarball"
  expected=$(expected_checksum "${os}_${arch}")
  actual=$(sha256_file "$tarball")
  if [[ "$actual" != "$expected" ]]; then
    echo "gitleaks ${version} checksum mismatch for ${os}/${arch}" >&2
    echo "expected ${expected}" >&2
    echo "actual   ${actual}" >&2
    rm -f "$tarball"
    exit 1
  fi
  tar -xzf "$tarball" -C "$cache" gitleaks
  chmod +x "$bin"
  rm -f "$tarball"
fi

canary=""
report=""
cleanup() {
  if [[ -n "$canary" ]]; then
    rm -rf "$canary"
  fi
  if [[ -n "$report" ]]; then
    rm -f "$report"
  fi
}
trap cleanup EXIT

# Prove the config still loads the default detectors. The fixture stays in a
# temp directory so the canary string never enters git history.
canary=$(mktemp -d)
repo=$(pwd)
case "$canary" in
  "$repo" | "$repo"/*)
    echo "gitleaks canary directory must be outside the repo" >&2
    exit 1
    ;;
esac
# Split so this script does not itself contain an access-key-shaped literal.
canary_value="$(printf '%s%s%s' 'AKI' 'A' 'W3K7Q2M5N6P4R7T2')"
printf 'aws_access_key_id=%s\n' "$canary_value" >"$canary/leak.txt"
report=/tmp/cookbook-gitleaks-canary.json
rm -f "$report"

set +e
"$bin" detect \
  --source "$canary" \
  --no-git \
  --config .gitleaks.toml \
  --no-banner \
  --redact \
  --report-format json \
  --report-path "$report" \
  --exit-code 1 \
  >/tmp/cookbook-gitleaks-canary.txt
canary_status=$?
set -e
if [[ "$canary_status" -ne 1 ]]; then
  echo "gitleaks canary should exit 1 when default rules are active, got ${canary_status}" >&2
  exit 1
fi
if ! grep -q 'aws-access-token' "$report"; then
  echo "gitleaks canary was not detected by the default aws rule" >&2
  exit 1
fi
rm -f "$report"

"$bin" detect --source . --config .gitleaks.toml --no-banner --redact --exit-code 1
