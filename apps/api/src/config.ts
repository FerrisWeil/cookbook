const DEFAULT_PORT = 3000;
const DEFAULT_BIND_HOST = "127.0.0.1";
const REJECTED_PASSWORDS = new Set(["replace-me", "cookbook"]);
const MIN_TOKEN_LENGTH = 16;
const PLACEHOLDER_TOKENS = new Set([
  "replace-with-a-long-random-token",
  "replace-me",
]);
const DEV_TOKENS = new Set([
  "local-dev-api-mcp-token-not-for-nas",
  "local-dev-api-web-token-not-for-nas",
]);

export type Config = {
  bindHost: string;
  port: number;
  databaseUrl: string;
  migratorDatabaseUrl: string;
  migrationsDir: string;
  seedFile: string;
  apiAuthTokenMcp: string;
  apiAuthTokenWeb: string;
};

function requiredToken(env: NodeJS.Dict<string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Generate one with: openssl rand -hex 32`,
    );
  }
  if (PLACEHOLDER_TOKENS.has(value)) {
    throw new Error(
      `${name} is a public placeholder. Generate one with: openssl rand -hex 32`,
    );
  }
  if (DEV_TOKENS.has(value) && env.API_ALLOW_DEV_TOKEN?.trim() !== "1") {
    throw new Error(
      `${name} is a local dev token. Set API_ALLOW_DEV_TOKEN=1 only for local compose, never on the NAS`,
    );
  }
  if (value.length < MIN_TOKEN_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_TOKEN_LENGTH} characters`);
  }
  return value;
}

function parsePort(value: string | undefined, name: string): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer 1-65535, got ${value}`);
  }
  return port;
}

function rejectUrlPassword(url: string, name: string): void {
  let password = "";
  try {
    password = decodeURIComponent(new URL(url).password);
  } catch {
    throw new Error(`${name} is not a usable postgres url`);
  }
  if (password.trim() === "") {
    throw new Error(`${name} is required`);
  }
  rejectKnownPassword(name, password);
}

function rejectKnownPassword(name: string, password: string): void {
  if (REJECTED_PASSWORDS.has(password)) {
    throw new Error(
      `${name} is a placeholder or the old shared dev password. Generate one with: openssl rand -base64 24`,
    );
  }
}

function databaseUrlFromParts(
  user: string,
  password: string,
  host: string,
  port: string,
  database: string,
): string {
  const portNumber = parsePort(port, "POSTGRES_PORT");
  const userInfo = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${userInfo}@${host}:${portNumber}/${encodeURIComponent(database)}`;
}

function passwordFromEnv(
  env: NodeJS.Dict<string>,
  name: string,
): string | undefined {
  const password = env[name];
  if (password === undefined) {
    return undefined;
  }
  if (password.trim() === "") {
    throw new Error(`${name} is required`);
  }
  rejectKnownPassword(name, password);
  return password;
}

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  const host = env.POSTGRES_HOST?.trim() || "db";
  const port = env.POSTGRES_PORT?.trim() || "5432";
  const database = env.POSTGRES_DB?.trim() || "cookbook";
  const appUrl = env.DATABASE_URL?.trim() ?? "";
  const migratorUrl = env.MIGRATOR_DATABASE_URL?.trim() ?? "";

  let databaseUrl = appUrl;
  let migratorDatabaseUrl = migratorUrl;
  if (appUrl || migratorUrl) {
    if (!appUrl || !migratorUrl) {
      throw new Error("DATABASE_URL and MIGRATOR_DATABASE_URL must both be set");
    }
    if (appUrl === migratorUrl) {
      throw new Error("migrator and app database urls must be different");
    }
    rejectUrlPassword(appUrl, "DATABASE_URL");
    rejectUrlPassword(migratorUrl, "MIGRATOR_DATABASE_URL");
  } else {
    const appUser = env.POSTGRES_APP_USER?.trim();
    const appPassword = passwordFromEnv(env, "POSTGRES_APP_PASSWORD");
    const migratorUser = env.POSTGRES_MIGRATOR_USER?.trim();
    const migratorPassword = passwordFromEnv(env, "POSTGRES_MIGRATOR_PASSWORD");
    if (!appUser || !appPassword || !migratorUser || !migratorPassword) {
      throw new Error(
        "DATABASE_URL and MIGRATOR_DATABASE_URL, or POSTGRES_APP_USER, POSTGRES_APP_PASSWORD, POSTGRES_MIGRATOR_USER, and POSTGRES_MIGRATOR_PASSWORD, are required",
      );
    }
    databaseUrl = databaseUrlFromParts(
      appUser,
      appPassword,
      host,
      port,
      database,
    );
    migratorDatabaseUrl = databaseUrlFromParts(
      migratorUser,
      migratorPassword,
      host,
      port,
      database,
    );
  }

  const apiAuthTokenMcp = requiredToken(env, "API_AUTH_TOKEN_MCP");
  const apiAuthTokenWeb = requiredToken(env, "API_AUTH_TOKEN_WEB");
  if (apiAuthTokenMcp === apiAuthTokenWeb) {
    throw new Error("API_AUTH_TOKEN_MCP and API_AUTH_TOKEN_WEB must differ");
  }
  const mcpAuthToken = env.MCP_AUTH_TOKEN?.trim();
  if (mcpAuthToken && (apiAuthTokenMcp === mcpAuthToken || apiAuthTokenWeb === mcpAuthToken)) {
    throw new Error("API caller tokens must differ from MCP_AUTH_TOKEN");
  }

  return {
    bindHost: env.BIND_HOST?.trim() || DEFAULT_BIND_HOST,
    port: parsePort(env.PORT, "PORT"),
    databaseUrl,
    migratorDatabaseUrl,
    migrationsDir: env.MIGRATIONS_DIR?.trim() || "db/migrations",
    seedFile: env.SEED_FILE?.trim() || "db/seed.sql",
    apiAuthTokenMcp,
    apiAuthTokenWeb,
  };
}
