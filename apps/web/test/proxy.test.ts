import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  incomingRecipeApiPath,
  isRecipeReadMethod,
  loadWebToken,
  recipeAuthorization,
  shouldAttachWebToken,
  upstreamRecipePath,
} from "../dev-proxy.ts";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    assert.equal(incomingRecipeApiPath("/api/recipesfoo"), false);
    assert.equal(incomingRecipeApiPath("/api/health"), false);
    assert.equal(upstreamRecipePath("/recipes"), true);
    assert.equal(upstreamRecipePath("/recipes/alpha"), true);
    assert.equal(upstreamRecipePath("/health"), false);
    assert.equal(shouldAttachWebToken("/api/recipes?limit=1"), true);
    assert.equal(shouldAttachWebToken("/health"), false);
    assert.equal(isRecipeReadMethod("GET"), true);
    assert.equal(isRecipeReadMethod("HEAD"), true);
    assert.equal(isRecipeReadMethod("PUT"), false);
    assert.equal(isRecipeReadMethod("POST"), false);
    assert.equal(
      recipeAuthorization("test-api-web-token-xx"),
      "Bearer test-api-web-token-xx",
    );
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
