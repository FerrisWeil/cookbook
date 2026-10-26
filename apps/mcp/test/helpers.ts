import type { Config } from "../src/config.ts";

export const TEST_TOKEN = "test-token-not-for-production";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    authToken: TEST_TOKEN,
    bindHost: "127.0.0.1",
    port: 0,
    hostname: "cookbook-mcp",
    allowedHosts: ["localhost", "127.0.0.1", "::1", "cookbook-mcp"],
    ...overrides,
  };
}
