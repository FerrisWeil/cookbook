import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifies } from "@cookbook/test";

import {
  incomingRecipeApiPath,
  isJsonContentType,
  isRecipeFactsMethod,
  isRecipeFactsPath,
  isRecipeReadMethod,
  isSameOriginFactsRequest,
  loadWebToken,
  recipeAuthorization,
  recipeProxyDecision,
  sessionProxyDecision,
  shouldAttachWebToken,
  upstreamRecipePath,
} from "../dev-proxy.ts";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");

function walkFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkFiles(path, found);
    } else {
      found.push(path);
    }
  }
  return found;
}

describe("read-only recipe proxy", () => {
  it("loads a web token and refuses placeholders", () => {
    assert.equal(
      loadWebToken({
        API_AUTH_TOKEN_WEB: "test-api-web-token-xx",
      }),
      "test-api-web-token-xx",
    );
    assert.throws(() => loadWebToken({}), /API_AUTH_TOKEN_WEB is required/);
    assert.throws(
      () => loadWebToken({ API_AUTH_TOKEN_WEB: "short-token" }),
      /at least 16/,
    );
    assert.throws(
      () =>
        loadWebToken({
          API_AUTH_TOKEN_WEB: "replace-with-a-long-random-token",
        }),
      /placeholder/,
    );
    assert.throws(
      () =>
        loadWebToken({
          API_AUTH_TOKEN_WEB: "local-dev-api-web-token-not-for-nas",
        }),
      /API_ALLOW_DEV_TOKEN=1/,
    );
    assert.equal(
      loadWebToken({
        API_AUTH_TOKEN_WEB: "local-dev-api-web-token-not-for-nas",
        API_ALLOW_DEV_TOKEN: "1",
      }),
      "local-dev-api-web-token-not-for-nas",
    );
  });

  it("attaches the bearer only on recipe reads", () => {
    assert.equal(incomingRecipeApiPath("/api/recipes"), true);
    assert.equal(incomingRecipeApiPath("/api/recipes/alpha"), true);
    assert.equal(incomingRecipeApiPath("/api/recipes/events"), true);
    assert.equal(incomingRecipeApiPath("/api/recipesfoo"), false);
    assert.equal(incomingRecipeApiPath("/api/health"), false);
    assert.equal(upstreamRecipePath("/recipes"), true);
    assert.equal(upstreamRecipePath("/recipes/alpha"), true);
    assert.equal(upstreamRecipePath("/recipes/events"), true);
    assert.equal(upstreamRecipePath("/health"), false);
    assert.equal(shouldAttachWebToken("/api/recipes?limit=1"), true);
    assert.equal(shouldAttachWebToken("/api/recipes/events"), true);
    assert.equal(shouldAttachWebToken("/health"), false);
    assert.equal(isRecipeReadMethod("GET"), true);
    assert.equal(isRecipeReadMethod("HEAD"), true);
    assert.equal(isRecipeReadMethod("PUT"), false);
    assert.equal(isRecipeReadMethod("POST"), false);
    assert.equal(isRecipeReadMethod("PATCH"), false);
    assert.equal(
      recipeAuthorization("test-api-web-token-xx"),
      "Bearer test-api-web-token-xx",
    );
  });

  it("disables nginx stream buffering for the recipe event stream", () => {
    const docker = readFileSync(
      join(webRoot, "../../docker/nginx.conf"),
      "utf8",
    );
    const nas = readFileSync(
      join(webRoot, "../../deploy/nas/nginx.conf"),
      "utf8",
    );
    for (const config of [docker, nas]) {
      assert.match(config, /location = \/api\/recipes\/events/);
      const block = config.split("location = /api/recipes/events")[1] ?? "";
      const events = block.split("location /api/recipes")[0] ?? "";
      assert.match(events, /proxy_buffering off/);
      assert.match(events, /proxy_read_timeout 1h/);
      assert.match(events, /if \(\$request_method != GET\)/);
      assert.doesNotMatch(events, /proxy_pass http:\/\/api:3000\/recipes;/);
    }
  });

  it("sets an unbounded Vite timeout on the event stream only", () => {
    const config = readFileSync(join(webRoot, "vite.config.ts"), "utf8");
    const afterEvents = config.split('"/api/recipes/events"')[1] ?? "";
    const events = afterEvents.split('"/api"')[0] ?? "";
    const rest = afterEvents.split('"/api"')[1] ?? "";
    assert.match(events, /timeout: 0/);
    assert.match(events, /proxyTimeout: 0/);
    assert.doesNotMatch(rest, /timeout: 0/);
    assert.doesNotMatch(rest, /proxyTimeout: 0/);
  });

  it("does not put the web token in client source", () => {
    const files = [
      join(webRoot, "index.html"),
      ...walkFiles(join(webRoot, "src")),
      ...walkFiles(join(webRoot, "public")),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("API_AUTH_TOKEN_WEB"), false, file);
      assert.equal(text.includes("local-dev-api-web-token-not-for-nas"), false, file);
      assert.equal(text.includes("Bearer "), false, file);
    }
  });
});

describe("cooking session proxy", () => {
  it(
    "forwards a same-origin session call and refuses a cross-origin write",
    verifies("209", "d8381f0354b89484", () => {
      const headers = {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
        "sec-fetch-site": "same-origin" as const,
      };
      assert.deepEqual(sessionProxyDecision("POST", "/api/sessions", headers), {
        allow: true,
        attachToken: true,
      });
      assert.deepEqual(sessionProxyDecision("GET", "/api/sessions/active", headers), {
        allow: true,
        attachToken: true,
      });
      assert.deepEqual(
        sessionProxyDecision("POST", "/api/sessions/soup/steps/0/complete", headers),
        { allow: true, attachToken: true },
      );
      const cross = sessionProxyDecision("POST", "/api/sessions/soup/finish", {
        origin: "https://evil.example",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      });
      assert.equal(cross.allow, false);
      assert.equal(cross.status, 403);
      const nginx = [
        readFileSync(join(repoRoot, "docker/nginx.conf"), "utf8"),
        readFileSync(join(repoRoot, "deploy/nas/nginx.conf"), "utf8"),
      ].join("\n");
      assert.match(nginx, /location = \/api\/sessions \{/);
      assert.match(nginx, /location = \/api\/sessions\/active/);
      assert.match(nginx, /steps\/\[0-9\]\+\/\(complete\|undo\)/);
    }),
  );
});

describe("facts mutation proxy", () => {
  it(
    "lets the browser update facts from the same origin and refuses a full recipe save",
    verifies("187", "636ac7e770b30442", () => {
      const ok = recipeProxyDecision("PATCH", "/api/recipes/alpha/facts", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      });
      assert.deepEqual(ok, { allow: true, attachToken: true });
      const fullSave = recipeProxyDecision("PUT", "/api/recipes", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
      });
      assert.equal(fullSave.allow, false);
      assert.equal(fullSave.status, 405);
      const nginx = [
        readFileSync(join(repoRoot, "docker/nginx.conf"), "utf8"),
        readFileSync(join(repoRoot, "deploy/nas/nginx.conf"), "utf8"),
      ].join("\n");
      assert.match(nginx, /location ~ \^\/api\/recipes\/\(\[\^\/\]\+\)\/facts\$/);
      assert.match(nginx, /if \(\$request_method != PATCH\)/);
      assert.match(nginx, /rewrite \^ \/recipes\/\$facts_id\/facts break;/);
      assert.match(
        nginx,
        /location \/api\/recipes \{\s*if \(\$request_method !~ \^\(GET\|HEAD\)\$\)/,
      );
      assert.equal(isRecipeFactsPath("/api/recipes/alpha/facts"), true);
      assert.equal(isRecipeFactsPath("/api/recipes/alpha"), false);
      assert.equal(isRecipeFactsPath("/api/recipes/alpha/facts/extra"), false);
      assert.equal(isRecipeFactsMethod("PATCH"), true);
      assert.equal(isRecipeFactsMethod("PUT"), false);
    }),
  );

  it(
    "refuses a facts update from a different origin",
    verifies("188", "9ba9d7157047d0fe", () => {
      const cross = recipeProxyDecision("PATCH", "/api/recipes/alpha/facts", {
        origin: "https://evil.example",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      });
      assert.equal(cross.allow, false);
      assert.equal(cross.status, 403);
      assert.equal(
        isSameOriginFactsRequest({
          origin: "https://evil.example",
          host: "127.0.0.1:8080",
        }),
        false,
      );
      assert.equal(
        isSameOriginFactsRequest({
          origin: "http://127.0.0.1:8080",
          host: "127.0.0.1:8080",
        }),
        true,
      );
      const missing = recipeProxyDecision("PATCH", "/api/recipes/alpha/facts", {
        host: "127.0.0.1:8080",
        "content-type": "application/json",
      });
      assert.equal(missing.allow, false);
      assert.equal(missing.status, 403);
    }),
  );

  it(
    "refuses a facts update that is not PATCH or not JSON",
    verifies("189", "f116930ae5df1bae", () => {
      const post = recipeProxyDecision("POST", "/api/recipes/alpha/facts", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
      });
      assert.equal(post.allow, false);
      assert.equal(post.status, 405);
      const put = recipeProxyDecision("PUT", "/api/recipes/alpha/facts", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/json",
      });
      assert.equal(put.allow, false);
      assert.equal(put.status, 405);
      const get = recipeProxyDecision("GET", "/api/recipes/alpha/facts", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
      });
      assert.equal(get.allow, false);
      assert.equal(get.status, 405);
      const form = recipeProxyDecision("PATCH", "/api/recipes/alpha/facts", {
        origin: "http://127.0.0.1:8080",
        host: "127.0.0.1:8080",
        "content-type": "application/x-www-form-urlencoded",
      });
      assert.equal(form.allow, false);
      assert.equal(form.status, 415);
      assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
      assert.equal(isJsonContentType("text/plain"), false);
    }),
  );
});
