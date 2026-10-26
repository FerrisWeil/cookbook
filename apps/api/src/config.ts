const DEFAULT_PORT = 3000;
const DEFAULT_BIND_HOST = "127.0.0.1";

export type Config = {
  bindHost: string;
  port: number;
  databaseUrl: string;
  migrationsDir: string;
  seedFile: string;
};

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

function databaseUrl(env: NodeJS.Dict<string>): string {
  const configured = env.DATABASE_URL?.trim();
  if (configured) {
    return configured;
  }

  const user = env.POSTGRES_USER?.trim();
  const password = env.POSTGRES_PASSWORD;
  const database = env.POSTGRES_DB?.trim() || "cookbook";
  const host = env.POSTGRES_HOST?.trim() || "db";
  const port = env.POSTGRES_PORT?.trim() || "5432";
  if (!user || password === undefined || password.trim() === "") {
    throw new Error(
      "DATABASE_URL or both POSTGRES_USER and POSTGRES_PASSWORD are required",
    );
  }
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    throw new Error(`POSTGRES_PORT must be an integer 1-65535, got ${port}`);
  }

  const userInfo = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${userInfo}@${host}:${port}/${encodeURIComponent(database)}`;
}

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  return {
    bindHost: env.BIND_HOST?.trim() || DEFAULT_BIND_HOST,
    port: parsePort(env.PORT),
    databaseUrl: databaseUrl(env),
    migrationsDir: env.MIGRATIONS_DIR?.trim() || "db/migrations",
    seedFile: env.SEED_FILE?.trim() || "db/seed.sql",
  };
}
