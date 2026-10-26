#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cleanup() {
  docker compose down
}
trap cleanup EXIT

# Render the NAS file with dummy values. Do not start that stack.
POSTGRES_PASSWORD=dummy-password \
  MCP_AUTH_TOKEN=dummy-mcp-token-not-a-secret \
  TS_WEB_AUTHKEY=dummy-web-authkey \
  TS_MCP_AUTHKEY=dummy-mcp-authkey \
  docker compose -f deploy/nas/docker-compose.yml config \
  >/tmp/cookbook-nas-config.yml
grep -q '/mnt/user/appdata/cookbook/postgres' /tmp/cookbook-nas-config.yml
grep -q '/mnt/user/appdata/cookbook/tailscale-web' /tmp/cookbook-nas-config.yml
grep -q '/mnt/user/appdata/cookbook/tailscale-mcp' /tmp/cookbook-nas-config.yml
grep -q 'dummy-web-authkey' /tmp/cookbook-nas-config.yml
grep -q 'dummy-mcp-authkey' /tmp/cookbook-nas-config.yml
grep -q 'BIND_HOST: 127.0.0.1' /tmp/cookbook-nas-config.yml
if grep -q 'MCP_ALLOW_DEV_TOKEN' /tmp/cookbook-nas-config.yml; then
  echo "NAS compose must not set MCP_ALLOW_DEV_TOKEN" >&2
  exit 1
fi
if grep -q '\.\./\.\./data' /tmp/cookbook-nas-config.yml; then
  echo "NAS compose still bind-mounts a path inside the checkout" >&2
  exit 1
fi

# Local Postgres passwords are generated per run and never printed.
# shellcheck disable=SC2155
export POSTGRES_SUPERUSER_PASSWORD="$(openssl rand -hex 24)"
export POSTGRES_MIGRATOR_PASSWORD="$(openssl rand -hex 24)"
export POSTGRES_APP_PASSWORD="$(openssl rand -hex 24)"

docker compose up --build -d --wait

if docker compose port db 5432 >/dev/null 2>&1; then
  echo "local compose published Postgres" >&2
  exit 1
fi

app_super=$(docker compose exec -T db psql -U postgres -d cookbook -tAc "SELECT rolsuper FROM pg_roles WHERE rolname = 'cookbook_app'" | tr -d '[:space:]')
migrator_super=$(docker compose exec -T db psql -U postgres -d cookbook -tAc "SELECT rolsuper FROM pg_roles WHERE rolname = 'cookbook_migrator'" | tr -d '[:space:]')
if [[ "$app_super" != "f" || "$migrator_super" != "f" ]]; then
  echo "database roles must not be superuser (app=${app_super} migrator=${migrator_super})" >&2
  exit 1
fi

# ON_ERROR_STOP makes psql exit non-zero. Without it, a permission error
# still exits 0 and this check would look like CREATE TABLE succeeded.
if docker compose exec -T -e PGPASSWORD="$POSTGRES_APP_PASSWORD" db \
  psql -U cookbook_app -d cookbook -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE app_role_must_not_create(id int);" >/tmp/cookbook-app-ddl.txt 2>&1; then
  echo "cookbook_app was able to CREATE TABLE" >&2
  exit 1
fi
if ! grep -q "permission denied for schema" /tmp/cookbook-app-ddl.txt; then
  echo "cookbook_app DDL failure was not permission denied for schema" >&2
  cat /tmp/cookbook-app-ddl.txt >&2
  exit 1
fi

if docker compose exec -T api printenv POSTGRES_SUPERUSER_PASSWORD >/dev/null 2>&1; then
  echo "API container has the Postgres superuser password" >&2
  exit 1
fi

curl -fsS http://127.0.0.1:3000/health | tee /tmp/cookbook-api-health.json
grep -q '"status":"ok"' /tmp/cookbook-api-health.json

curl -fsS http://127.0.0.1:3000/health/ready | tee /tmp/cookbook-api-ready.json
grep -q '"database":"up"' /tmp/cookbook-api-ready.json
grep -q '"seed":true' /tmp/cookbook-api-ready.json
grep -q '"status":"ok"' /tmp/cookbook-api-ready.json

curl -fsS http://127.0.0.1:8787/health | tee /tmp/cookbook-mcp-health.json
grep -q '"status":"ok"' /tmp/cookbook-mcp-health.json

code=$(curl -sS -o /tmp/cookbook-mcp-unauth.json -w '%{http_code}' http://127.0.0.1:8787/mcp)
test "$code" = "401"

# Same client the unit tests use. Requires `pnpm install` (CI does this).
(
  cd apps/mcp
  MCP_URL=http://127.0.0.1:8787/mcp \
    MCP_SMOKE_TOKEN=local-dev-token-not-for-nas \
    node --input-type=module <<'EOF'
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const token = process.env.MCP_SMOKE_TOKEN;
const url = process.env.MCP_URL;
if (!token || !url) {
  console.error("MCP smoke token and URL are required");
  process.exit(1);
}
const client = new Client({ name: "cookbook-smoke", version: "0.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: {
    headers: { authorization: `Bearer ${token}` },
  },
});
await client.connect(transport);
try {
  const result = await client.callTool({ name: "hello", arguments: {} });
  const body = JSON.stringify(result);
  if (result.isError || !body.includes("Cookbook MCP is up.")) {
    console.error(body);
    process.exit(1);
  }
  process.stdout.write(`${body}\n`);
} finally {
  await client.close();
}
EOF
) | tee /tmp/cookbook-mcp-hello.json
grep -q "Cookbook MCP is up." /tmp/cookbook-mcp-hello.json

curl -fsS http://127.0.0.1:8080 | tee /tmp/cookbook-web.html
grep -q "Cookbook" /tmp/cookbook-web.html

curl -fsS http://127.0.0.1:8080/api/health/ready | tee /tmp/cookbook-web-api.json
grep -q '"database":"up"' /tmp/cookbook-web-api.json
grep -q '"status":"ok"' /tmp/cookbook-web-api.json
