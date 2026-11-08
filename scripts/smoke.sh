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
  API_AUTH_TOKEN_MCP=dummy-api-mcp-token-not-a-secret \
  API_AUTH_TOKEN_WEB=dummy-api-web-token-not-a-secret \
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
if grep -q 'API_ALLOW_DEV_TOKEN' /tmp/cookbook-nas-config.yml; then
  echo "NAS compose must not set API_ALLOW_DEV_TOKEN" >&2
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

# `docker compose port` exits 0 for an EXPOSE with no host binding and prints
# ":0". HostConfig.PortBindings is empty unless the Compose file publishes.
db_id="$(docker compose ps -q db)"
bindings="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$db_id")"
case "$bindings" in
  "" | null | {}) ;;
  *)
    echo "local compose published Postgres: ${bindings}" >&2
    exit 1
    ;;
esac

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

actors="$(docker compose exec -T db psql -U postgres -d cookbook -tAc "SELECT string_agg(name, ',' ORDER BY name) FROM actors" | tr -d '[:space:]')"
if [[ "$actors" != "chef,system,taylor" ]]; then
  echo "expected shipped actors chef,system,taylor; got ${actors}" >&2
  exit 1
fi
if docker compose exec -T db psql -U postgres -d cookbook -v ON_ERROR_STOP=1 \
  -c "INSERT INTO recipes (id, title, servings, actor) VALUES ('smoke-empty-title', '', 1, 'chef');" \
  >/tmp/cookbook-empty-title.txt 2>&1; then
  echo "empty recipe title was accepted" >&2
  exit 1
fi
if ! grep -q 'recipes_title_present' /tmp/cookbook-empty-title.txt; then
  echo "empty recipe title did not fail recipes_title_present" >&2
  cat /tmp/cookbook-empty-title.txt >&2
  exit 1
fi

curl -fsS http://127.0.0.1:8787/health | tee /tmp/cookbook-mcp-health.json
grep -q '"status":"ok"' /tmp/cookbook-mcp-health.json

code=$(curl -sS -o /tmp/cookbook-mcp-unauth.json -w '%{http_code}' http://127.0.0.1:8787/mcp)
test "$code" = "401"

code=$(curl -sS -o /tmp/cookbook-api-unauth.json -w '%{http_code}' http://127.0.0.1:3000/recipes)
test "$code" = "401"

api_mcp_token="${API_AUTH_TOKEN_MCP:-local-dev-api-mcp-token-not-for-nas}"
curl -fsS -H "Authorization: Bearer ${api_mcp_token}" \
  http://127.0.0.1:3000/recipes | tee /tmp/cookbook-api-recipes.json
grep -q '"recipes":' /tmp/cookbook-api-recipes.json

curl -fsS http://127.0.0.1:8080/api/recipes | tee /tmp/cookbook-web-recipes.json
grep -q '"recipes":' /tmp/cookbook-web-recipes.json

code=$(curl -sS -o /tmp/cookbook-web-put.json -w '%{http_code}' \
  -X PUT http://127.0.0.1:8080/api/recipes \
  -H 'content-type: application/json' \
  -d '{"title":"Example: Should not save","steps":["no"],"servings":1,"actor":"chef"}')
if [[ "$code" != "405" ]]; then
  echo "web proxy forwarded a recipe write: ${code}" >&2
  cat /tmp/cookbook-web-put.json >&2
  exit 1
fi

code=$(curl -sS -o /tmp/cookbook-web-events-put.json -w '%{http_code}' \
  -X PUT http://127.0.0.1:8080/api/recipes/events)
if [[ "$code" != "405" ]]; then
  echo "web proxy forwarded a write to the event stream: ${code}" >&2
  cat /tmp/cookbook-web-events-put.json >&2
  exit 1
fi

acks_table="$(docker compose exec -T db psql -U postgres -d cookbook -tAc "SELECT to_regclass('public.recipe_mutation_acks')" | tr -d '[:space:]')"
if [[ "$acks_table" != "recipe_mutation_acks" ]]; then
  echo "recipe_mutation_acks was not applied" >&2
  exit 1
fi
if docker compose exec -T -e PGPASSWORD="$POSTGRES_APP_PASSWORD" db \
  psql -U cookbook_app -d cookbook -v ON_ERROR_STOP=1 \
  -c "INSERT INTO recipe_mutation_acks (mutation_id, payload_fingerprint, recipe_id) VALUES ('smoke-mut', 'fp-a', 'smoke-recipe');" \
  >/tmp/cookbook-mut-ack-insert.txt 2>&1; then
  :
else
  echo "cookbook_app could not insert a mutation ack" >&2
  cat /tmp/cookbook-mut-ack-insert.txt >&2
  exit 1
fi
if docker compose exec -T -e PGPASSWORD="$POSTGRES_APP_PASSWORD" db \
  psql -U cookbook_app -d cookbook -v ON_ERROR_STOP=1 \
  -c "INSERT INTO recipe_mutation_acks (mutation_id, payload_fingerprint, recipe_id) VALUES ('smoke-mut', 'fp-b', 'smoke-recipe');" \
  >/tmp/cookbook-mut-ack-dup.txt 2>&1; then
  echo "duplicate mutation_id was accepted" >&2
  exit 1
fi

web_token="${API_AUTH_TOKEN_WEB:-local-dev-api-web-token-not-for-nas}"
if grep -Fq "$web_token" /tmp/cookbook-web-recipes.json; then
  echo "web token leaked in a browser-facing payload" >&2
  exit 1
fi

# Same client the unit tests use. Requires `pnpm install` (CI does this).
(
  cd apps/mcp
  MCP_URL=http://127.0.0.1:8787/mcp \
    MCP_SMOKE_TOKEN="${MCP_AUTH_TOKEN:-local-dev-token-not-for-nas}" \
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
  const hello = await client.callTool({ name: "hello", arguments: {} });
  const helloBody = JSON.stringify(hello);
  if (hello.isError || !helloBody.includes("Cookbook MCP is up.")) {
    console.error(helloBody);
    process.exit(1);
  }
  process.stdout.write(`${helloBody}\n`);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort().join(",");
  if (names !== "hello,list,read,save") {
    console.error(names);
    process.exit(1);
  }
  const saved = await client.callTool({
    name: "save",
    arguments: {
      title: "Example: Smoke",
      ingredients: [{ line: "1 cup water" }],
      steps: ["check"],
      servings: 1,
      actor: "chef",
    },
  });
  if (saved.isError) {
    process.exit(1);
  }
  const listedRecipes = await client.callTool({ name: "list", arguments: {} });
  if (listedRecipes.isError) {
    process.exit(1);
  }
} finally {
  await client.close();
}
EOF
) | tee /tmp/cookbook-mcp-hello.json
grep -q "Cookbook MCP is up." /tmp/cookbook-mcp-hello.json

curl -fsS http://127.0.0.1:8080 | tee /tmp/cookbook-web.html
grep -q "Cookbook" /tmp/cookbook-web.html

web_token="${API_AUTH_TOKEN_WEB:-local-dev-api-web-token-not-for-nas}"
if grep -Fq "$web_token" /tmp/cookbook-web.html; then
  echo "web token leaked in HTML" >&2
  exit 1
fi
js_paths="$(printf '%s' "$(cat /tmp/cookbook-web.html)" | grep -oE '(src|href)="[^"]+\.js"' | grep -oE '/[^"]+\.js' || true)"
for src in $js_paths; do
  curl -fsS "http://127.0.0.1:8080${src}" | tee "/tmp/cookbook-web-asset.out" >/dev/null
  if grep -Fq "$web_token" /tmp/cookbook-web-asset.out; then
    echo "web token leaked in ${src}" >&2
    exit 1
  fi
done

curl -fsS http://127.0.0.1:8080/api/recipes | tee /tmp/cookbook-web-recipes-after.json
grep -q '"recipes":' /tmp/cookbook-web-recipes-after.json
grep -q "Example:" /tmp/cookbook-web-recipes-after.json
recipe_id="$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync("/tmp/cookbook-web-recipes-after.json","utf8")); const row=body.recipes.find((item)=>item.title.startsWith("Example:")); if(!row) process.exit(1); process.stdout.write(row.id)')"
curl -fsS "http://127.0.0.1:8080/api/recipes/${recipe_id}?fields=title,ingredients,steps,facts" \
  | tee /tmp/cookbook-web-recipe.json
grep -q '"title"' /tmp/cookbook-web-recipe.json
grep -q '"steps"' /tmp/cookbook-web-recipe.json
grep -q "1 cup water" /tmp/cookbook-web-recipe.json
grep -q '"facts"' /tmp/cookbook-web-recipe.json
if grep -Fq "$web_token" /tmp/cookbook-web-recipes-after.json /tmp/cookbook-web-recipe.json; then
  echo "web token leaked in a recipe payload" >&2
  exit 1
fi

code=$(curl -sS -o /tmp/cookbook-web-facts.json -w '%{http_code}' \
  -X PATCH "http://127.0.0.1:8080/api/recipes/${recipe_id}/facts" \
  -H 'content-type: application/json' \
  -H 'Origin: http://127.0.0.1:8080' \
  -d '{"mutationId":"smoke-facts-1","fields":{"primaryProtein":"chicken","totalMinutes":30,"effort":"low","mealTypes":["dinner"]}}')
if [[ "$code" != "200" ]]; then
  echo "web proxy did not accept a same-origin facts PATCH: ${code}" >&2
  cat /tmp/cookbook-web-facts.json >&2
  exit 1
fi
grep -q '"primaryProtein":"chicken"' /tmp/cookbook-web-facts.json

code=$(curl -sS -o /tmp/cookbook-web-facts-cross.json -w '%{http_code}' \
  -X PATCH "http://127.0.0.1:8080/api/recipes/${recipe_id}/facts" \
  -H 'content-type: application/json' \
  -H 'Origin: https://evil.example' \
  -d '{"mutationId":"smoke-facts-cross","fields":{"primaryProtein":"beef","totalMinutes":10,"effort":"high","mealTypes":["lunch"]}}')
if [[ "$code" != "403" ]]; then
  echo "web proxy allowed a cross-origin facts write: ${code}" >&2
  cat /tmp/cookbook-web-facts-cross.json >&2
  exit 1
fi

curl -fsS "http://127.0.0.1:8080/api/recipes/${recipe_id}?fields=title,facts" \
  | tee /tmp/cookbook-web-facts-read.json
grep -q '"primaryProtein":"chicken"' /tmp/cookbook-web-facts-read.json
if grep -Fq '"primaryProtein":"beef"' /tmp/cookbook-web-facts-read.json; then
  echo "cross-origin facts PATCH mutated the recipe" >&2
  exit 1
fi
if grep -Fq "$web_token" /tmp/cookbook-web-facts.json /tmp/cookbook-web-facts-read.json; then
  echo "web token leaked in a facts payload" >&2
  exit 1
fi

code=$(curl -sS -o /tmp/cookbook-web-facts-omit.json -w '%{http_code}' \
  -X PATCH "http://127.0.0.1:8080/api/recipes/${recipe_id}/facts" \
  -H 'content-type: application/json' \
  -H 'Origin: http://127.0.0.1:8080' \
  -d '{"mutationId":"smoke-facts-protein","fields":{"primaryProtein":"seitan"}}')
if [[ "$code" != "200" ]]; then
  echo "web proxy did not accept a partial facts PATCH: ${code}" >&2
  cat /tmp/cookbook-web-facts-omit.json >&2
  exit 1
fi
grep -q '"primaryProtein":"seitan"' /tmp/cookbook-web-facts-omit.json
grep -q '"totalMinutes":30' /tmp/cookbook-web-facts-omit.json

code=$(curl -sS -o /tmp/cookbook-web-facts-replay.json -w '%{http_code}' \
  -X PATCH "http://127.0.0.1:8080/api/recipes/${recipe_id}/facts" \
  -H 'content-type: application/json' \
  -H 'Origin: http://127.0.0.1:8080' \
  -d '{"mutationId":"smoke-facts-protein","fields":{"primaryProtein":"seitan"}}')
if [[ "$code" != "200" ]]; then
  echo "duplicate facts mutation was not acknowledged: ${code}" >&2
  cat /tmp/cookbook-web-facts-replay.json >&2
  exit 1
fi

code=$(curl -sS -o /tmp/cookbook-web-facts-mismatch.json -w '%{http_code}' \
  -X PATCH "http://127.0.0.1:8080/api/recipes/${recipe_id}/facts" \
  -H 'content-type: application/json' \
  -H 'Origin: http://127.0.0.1:8080' \
  -d '{"mutationId":"smoke-facts-protein","fields":{"primaryProtein":"beef"}}')
if [[ "$code" != "409" ]]; then
  echo "mismatched facts mutation was not rejected: ${code}" >&2
  cat /tmp/cookbook-web-facts-mismatch.json >&2
  exit 1
fi
grep -q '"primaryProtein":"seitan"' /tmp/cookbook-web-facts-read.json || true
curl -fsS "http://127.0.0.1:8080/api/recipes/${recipe_id}?fields=title,facts" \
  | tee /tmp/cookbook-web-facts-after-mismatch.json
grep -q '"primaryProtein":"seitan"' /tmp/cookbook-web-facts-after-mismatch.json
if grep -Fq '"primaryProtein":"beef"' /tmp/cookbook-web-facts-after-mismatch.json; then
  echo "mismatched facts mutation overwrote stored facts" >&2
  exit 1
fi

curl -fsS http://127.0.0.1:8080/api/health/ready | tee /tmp/cookbook-web-api.json
grep -q '"database":"up"' /tmp/cookbook-web-api.json
grep -q '"status":"ok"' /tmp/cookbook-web-api.json

code=$(curl -sS -o /tmp/cookbook-api-events-unauth.txt -w '%{http_code}' \
  http://127.0.0.1:3000/recipes/events)
test "$code" = "401"

SMOKE_RECIPE_ID="$recipe_id" node --input-type=module <<'EOF' | tee /tmp/cookbook-sse.log
const apiToken = process.env.API_AUTH_TOKEN_MCP ?? "local-dev-api-mcp-token-not-for-nas";
const webToken = process.env.API_AUTH_TOKEN_WEB ?? "local-dev-api-web-token-not-for-nas";
const recipeId = process.env.SMOKE_RECIPE_ID ?? "";

async function readUntil(url, headers, match, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { headers, signal: controller.signal });
  if (!response.ok) {
    throw new Error(`${url} status ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (match(text)) return text;
    }
    throw new Error(`no match: ${text}`);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    controller.abort();
  }
}

const apiStream = readUntil(
  "http://127.0.0.1:3000/recipes/events",
  { authorization: `Bearer ${apiToken}` },
  (chunk) => chunk.includes("event: committed"),
  8000,
);
const webStream = readUntil(
  "http://127.0.0.1:8080/api/recipes/events",
  {},
  (chunk) => chunk.includes("event: committed"),
  8000,
);
await new Promise((resolve) => setTimeout(resolve, 300));
const patched = await fetch(
  "http://127.0.0.1:3000/recipes/" + encodeURIComponent(recipeId) + "/facts",
  {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mutationId: "smoke-facts-sse",
      fields: { effort: "medium" },
    }),
  },
);
if (!patched.ok) {
  throw new Error(`facts patch failed ${patched.status}`);
}
const saved = await fetch("http://127.0.0.1:3000/recipes", {
  method: "PUT",
  headers: {
    authorization: `Bearer ${apiToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    title: "Example: Live stream",
    steps: ["listen"],
    servings: 1,
    actor: "chef",
  }),
});
if (!saved.ok) {
  throw new Error(`save failed ${saved.status}`);
}
const [apiText, webText] = await Promise.all([apiStream, webStream]);
if (apiText.includes(apiToken) || webText.includes(webToken)) {
  throw new Error("token leaked on the event stream");
}
process.stdout.write("sse-ok\n");
EOF
grep -q "sse-ok" /tmp/cookbook-sse.log

# IndexedDB outbox through the live PATCH. GitHub runners have no Chrome.
if command -v google-chrome-stable >/dev/null 2>&1 \
  || command -v google-chrome >/dev/null 2>&1 \
  || command -v chromium >/dev/null 2>&1; then
  node scripts/browser-outbox.mjs | tee /tmp/cookbook-browser-outbox.log
  grep -q "browser-outbox-scroll-ok" /tmp/cookbook-browser-outbox.log
  grep -q "browser-outbox-twotab-ok" /tmp/cookbook-browser-outbox.log
  grep -q "browser-outbox-replay-ok" /tmp/cookbook-browser-outbox.log
  grep -q "browser-outbox-reject-ok" /tmp/cookbook-browser-outbox.log
else
  echo "browser-outbox skipped (no Chrome)"
fi

