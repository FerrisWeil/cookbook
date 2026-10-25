const DEFAULT_PORT = 3000;
const DEFAULT_BIND_HOST = "127.0.0.1";

export type Config = {
  bindHost: string;
  port: number;
  databaseUrl: string;
  migrationsDir: string;
  seedFile: string;
};

function required(env: NodeJS.Dict<string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
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

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  return {
    bindHost: env.BIND_HOST?.trim() || DEFAULT_BIND_HOST,
    port: parsePort(env.PORT),
    databaseUrl: required(env, "DATABASE_URL"),
    migrationsDir: env.MIGRATIONS_DIR?.trim() || "db/migrations",
    seedFile: env.SEED_FILE?.trim() || "db/seed.sql",
  };
}
