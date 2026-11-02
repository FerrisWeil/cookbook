const DEFAULT_PORT = 8787;
const DEFAULT_BIND_HOST = "127.0.0.1";
const DEFAULT_HOSTNAME = "cookbook-mcp";
const MIN_TOKEN_LENGTH = 16;
const DEV_TOKEN = "local-dev-token-not-for-nas";
const DEV_API_TOKEN = "local-dev-api-mcp-token-not-for-nas";
const PLACEHOLDER_TOKENS = new Set([
  "replace-with-a-long-random-token",
  "replace-me",
]);

export type Config = {
  authToken: string;
  apiAuthToken: string;
  apiBaseUrl: string;
  bindHost: string;
  port: number;
  hostname: string;
  allowedHosts: string[];
};

function required(env: NodeJS.Dict<string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Generate one with: openssl rand -hex 32`,
    );
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1-65535, got ${value}`);
  }
  return port;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requiredToken(
  env: NodeJS.Dict<string>,
  name: string,
  allowDevFlag: string,
  devToken: string,
): string {
  const value = required(env, name);
  if (PLACEHOLDER_TOKENS.has(value)) {
    throw new Error(
      `${name} is a public placeholder. Generate one with: openssl rand -hex 32`,
    );
  }
  if (value === devToken && env[allowDevFlag]?.trim() !== "1") {
    throw new Error(
      `${name} is the local dev token. Set ${allowDevFlag}=1 only for local compose, never on the NAS`,
    );
  }
  if (value.length < MIN_TOKEN_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_TOKEN_LENGTH} characters`);
  }
  return value;
}

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  const authToken = requiredToken(
    env,
    "MCP_AUTH_TOKEN",
    "MCP_ALLOW_DEV_TOKEN",
    DEV_TOKEN,
  );
  const apiAuthToken = requiredToken(
    env,
    "API_AUTH_TOKEN_MCP",
    "API_ALLOW_DEV_TOKEN",
    DEV_API_TOKEN,
  );
  if (authToken === apiAuthToken) {
    throw new Error("API_AUTH_TOKEN_MCP must differ from MCP_AUTH_TOKEN");
  }
  const apiBaseUrl = env.API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error("API_BASE_URL must be an http or https URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("API_BASE_URL must be an http or https URL");
  }

  const hostname = env.MCP_HOSTNAME?.trim() || DEFAULT_HOSTNAME;
  const extraHosts = parseList(env.MCP_ALLOWED_HOSTS);

  return {
    authToken,
    apiAuthToken,
    apiBaseUrl,
    bindHost: env.BIND_HOST?.trim() || DEFAULT_BIND_HOST,
    port: parsePort(env.PORT),
    hostname,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "::1",
      hostname,
      ...extraHosts,
    ],
  };
}
