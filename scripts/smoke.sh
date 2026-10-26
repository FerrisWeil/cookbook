#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cleanup() {
  docker compose down
}
trap cleanup EXIT

docker compose up --build -d --wait

curl -fsS http://127.0.0.1:3000/health | tee /tmp/cookbook-api-health.json
grep -q '"status":"ok"' /tmp/cookbook-api-health.json

curl -fsS http://127.0.0.1:3000/health/ready | tee /tmp/cookbook-api-ready.json
grep -q '"database":"up"' /tmp/cookbook-api-ready.json
grep -q '"seed":true' /tmp/cookbook-api-ready.json

curl -fsS http://127.0.0.1:8787/health | tee /tmp/cookbook-mcp-health.json
grep -q '"status":"ok"' /tmp/cookbook-mcp-health.json

code=$(curl -sS -o /tmp/cookbook-mcp-unauth.json -w '%{http_code}' http://127.0.0.1:8787/mcp)
test "$code" = "401"

curl -fsS http://127.0.0.1:8080 | tee /tmp/cookbook-web.html
grep -q "Cookbook" /tmp/cookbook-web.html

curl -fsS http://127.0.0.1:8080/api/health/ready | tee /tmp/cookbook-web-api.json
grep -q '"database":"up"' /tmp/cookbook-web-api.json
