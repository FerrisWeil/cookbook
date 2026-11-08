import pg from "pg";

import { loadConfig } from "./config.js";
import { getReadyStatus } from "./health.js";
import { listen } from "./http.js";
import {
  applyMigrations,
  applySeed,
  type ReleasableClient,
  type SqlClient,
} from "./migrate.js";
import {
  createCommitHub,
  notifyingRecipeStore,
  notifyingSessionStore,
} from "./commits.js";
import { createPgRecipeStore } from "./recipes/index.js";
import { createPgSessionStore } from "./sessions/index.js";

const { Pool } = pg;

let config;
try {
  config = loadConfig();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

function clientFrom(
  queryable: {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>;
  },
): SqlClient {
  return {
    async query(sql, params) {
      const result = await queryable.query(sql, params);
      return { rowCount: result.rowCount, rows: result.rows };
    },
  };
}

const migratorPool = new Pool({
  connectionString: config.migratorDatabaseUrl,
  max: 1,
});

async function checkout(): Promise<ReleasableClient> {
  const connection = await migratorPool.connect();
  return {
    ...clientFrom(connection),
    release() {
      connection.release();
    },
  };
}

try {
  await applyMigrations(checkout, config.migrationsDir);
  const connection = await migratorPool.connect();
  try {
    await applySeed(clientFrom(connection), config.seedFile);
  } finally {
    connection.release();
  }
} finally {
  await migratorPool.end();
}
console.log("migrations and seed applied");

const pool = new Pool({ connectionString: config.databaseUrl });
const db: SqlClient = clientFrom(pool);

async function appCheckout(): Promise<ReleasableClient> {
  const connection = await pool.connect();
  return {
    ...clientFrom(connection),
    release() {
      connection.release();
    },
  };
}

const commits = createCommitHub();
const api = await listen(config.bindHost, config.port, {
  getReady: () => getReadyStatus(db),
  recipes: notifyingRecipeStore(createPgRecipeStore(appCheckout), commits),
  sessions: notifyingSessionStore(createPgSessionStore(appCheckout), commits),
  callerTokens: [config.apiAuthTokenMcp, config.apiAuthTokenWeb],
  commits,
});

console.log(
  `cookbook-api listening on ${config.bindHost}:${config.port} (${api.url})`,
);

async function shutdown(signal: string): Promise<void> {
  console.log(`received ${signal}, shutting down`);
  await api.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
