#!/usr/bin/env bash
# Dockerd does not survive a snapshot. Start it, then the local cookbook stack.
set -euo pipefail

cd /workspace

if ! sudo docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid /var/run/docker.sock
  if ! sudo service docker start; then
    echo "service docker start failed; launching dockerd directly" >&2
    sudo mkdir -p /var/log
    sudo dockerd >/tmp/dockerd.log 2>&1 &
  fi
  ready=0
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "docker daemon did not become ready" >&2
    sudo docker info || true
    if [[ -f /tmp/dockerd.log ]]; then
      tail -n 80 /tmp/dockerd.log >&2 || true
    fi
    exit 1
  fi
fi

sudo docker compose up --build -d --wait
echo "cookbook stack is up"
