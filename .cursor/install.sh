#!/usr/bin/env bash
# Idempotent. Environment builds snapshot this result, so later agents skip it.
# Node and pnpm come from the default image. Docker is installed here because
# the default image does not include it.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1 || ! command -v fuse-overlayfs >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
    codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
    arch="$(dpkg --print-architecture)"
    echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  fi
  sudo apt-get update
  # Versions validated on Ubuntu 24.04 in a nested Cloud Agent VM.
  # force-confold: /etc/fuse.conf already exists on the base image.
  sudo apt-get install -y \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    docker-ce=5:29.9.2-1~ubuntu.24.04~noble \
    docker-ce-cli=5:29.9.2-1~ubuntu.24.04~noble \
    containerd.io=2.4.2-3~ubuntu.24.04~noble \
    docker-buildx-plugin=0.38.1-1~ubuntu.24.04~noble \
    docker-compose-plugin=5.6.1-1~ubuntu.24.04~noble \
    fuse-overlayfs \
    iptables
fi

sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "storage-driver": "fuse-overlayfs",
  "features": {
    "containerd-snapshotter": false
  }
}
EOF

if [[ -x /usr/sbin/iptables-legacy ]]; then
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
fi
if [[ -x /usr/sbin/ip6tables-legacy ]]; then
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy
fi

sudo groupadd -f docker
sudo usermod -aG docker ubuntu

cd /workspace
command -v pnpm >/dev/null
pnpm install --frozen-lockfile
