import type { Config } from "../src/config.ts";

export const TEST_TOKEN = "test-token-not-for-production";

export const TEST_API_TOKEN = "test-api-mcp-token-xx";
export const TEST_API_URL = "http://127.0.0.1:9";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    authToken: TEST_TOKEN,
    apiAuthToken: TEST_API_TOKEN,
    apiBaseUrl: TEST_API_URL,
    bindHost: "127.0.0.1",
    port: 0,
    hostname: "cookbook-mcp",
    allowedHosts: ["localhost", "127.0.0.1", "::1", "cookbook-mcp"],
    ...overrides,
  };
}
