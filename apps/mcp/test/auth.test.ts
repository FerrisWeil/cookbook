import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { covers } from "@cookbook/test";

import { loadConfig } from "../src/config.ts";
import { listen } from "../src/http.ts";
import { TEST_TOKEN, testConfig } from "./helpers.ts";

describe("config", () => {
  it("refuses to start without MCP_AUTH_TOKEN", () => {
    assert.throws(
      () => loadConfig({ PORT: "8787" }),
      /MCP_AUTH_TOKEN is required/,
    );
  });

  it("refuses a short token", () => {
    assert.throws(
      () => loadConfig({ MCP_AUTH_TOKEN: "short" }),
      /at least 16 characters/,
    );
  });

  it("refuses public placeholder tokens", () => {
    assert.throws(
      () => loadConfig({ MCP_AUTH_TOKEN: "replace-with-a-long-random-token" }),
      /public placeholder/,
    );
    assert.throws(
      () => loadConfig({ MCP_AUTH_TOKEN: "replace-me" }),
      /public placeholder/,
    );
  });

  it("allows the local dev token only when MCP_ALLOW_DEV_TOKEN=1", () => {
    covers("4.5.2");
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "local-dev-token-not-for-nas",
          API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
          API_BASE_URL: "http://api:3000",
        }),
      /MCP_ALLOW_DEV_TOKEN=1/,
    );
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "local-dev-token-not-for-nas",
          MCP_ALLOW_DEV_TOKEN: "0",
          API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
          API_BASE_URL: "http://api:3000",
        }),
      /MCP_ALLOW_DEV_TOKEN=1/,
    );
    const config = loadConfig({
      MCP_AUTH_TOKEN: "local-dev-token-not-for-nas",
      MCP_ALLOW_DEV_TOKEN: "1",
      API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
      API_BASE_URL: "http://api:3000",
    });
    assert.equal(config.authToken, "local-dev-token-not-for-nas");
  });

  it("refuses to start without API_AUTH_TOKEN_MCP", () => {
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "test-token-not-for-production",
          API_BASE_URL: "http://api:3000",
        }),
      /API_AUTH_TOKEN_MCP is required/,
    );
  });

  it("refuses to start without API_BASE_URL", () => {
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "test-token-not-for-production",
          API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
        }),
      /API_BASE_URL is required/,
    );
  });

  it("refuses when the MCP caller token matches MCP_AUTH_TOKEN", () => {
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "test-token-not-for-production",
          API_AUTH_TOKEN_MCP: "test-token-not-for-production",
          API_BASE_URL: "http://api:3000",
        }),
      /must differ from MCP_AUTH_TOKEN/,
    );
  });

  it("allows the local API caller token only when API_ALLOW_DEV_TOKEN=1", () => {
    assert.throws(
      () =>
        loadConfig({
          MCP_AUTH_TOKEN: "test-token-not-for-production",
          API_AUTH_TOKEN_MCP: "local-dev-api-mcp-token-not-for-nas",
          API_BASE_URL: "http://api:3000",
        }),
      /API_ALLOW_DEV_TOKEN=1/,
    );
    const config = loadConfig({
      MCP_AUTH_TOKEN: "test-token-not-for-production",
      API_AUTH_TOKEN_MCP: "local-dev-api-mcp-token-not-for-nas",
      API_ALLOW_DEV_TOKEN: "1",
      API_BASE_URL: "http://api:3000",
    });
    assert.equal(config.apiAuthToken, "local-dev-api-mcp-token-not-for-nas");
    assert.equal(config.apiBaseUrl, "http://api:3000");
  });
});

describe("http auth", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const { server, url } = await listen(testConfig());
    baseUrl = url;
    close = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
  });

  after(async () => {
    await close();
  });

  it("serves /health without a token", async () => {
    covers("6.3.2", "1.4.2", "1.4.3", "1.4.4");
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("rejects /mcp when the token is missing", async () => {
    covers("6.4.1", "1.4.1");
    const response = await fetch(`${baseUrl}/mcp`, { method: "POST" });
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("www-authenticate"),
      'Bearer realm="cookbook-mcp"',
    );
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("rejects /mcp when the token is wrong", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { authorization: "Bearer totally-wrong-token" },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("rejects a non-Bearer scheme even with the right secret", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { authorization: `Basic ${TEST_TOKEN}` },
    });
    assert.equal(response.status, 401);
  });
});
