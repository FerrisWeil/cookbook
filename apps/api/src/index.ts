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

const { Pool } = pg;

let config;
try {
  config = loadConfig();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

const pool = new Pool({ connectionString: config.databaseUrl });
const db: SqlClient = {
  async query(sql, params) {
    const result = await pool.query(sql, params);
    return { rowCount: result.rowCount, rows: result.rows };
  },
};

async function checkout(): Promise<ReleasableClient> {
  const connection = await pool.connect();
  return {
    async query(sql, params) {
      const result = await connection.query(sql, params);
      return { rowCount: result.rowCount, rows: result.rows };
    },
    release() {
      connection.release();
    },
  };
}

await applyMigrations(checkout, config.migrationsDir);
await applySeed(db, config.seedFile);
console.log("migrations and seed applied");

const { server, url } = await listen(config.bindHost, config.port, {
  getReady: () => getReadyStatus(db),
});

console.log(`cookbook-api listening on ${config.bindHost}:${config.port} (${url})`);

async function shutdown(signal: string): Promise<void> {
  console.log(`received ${signal}, shutting down`);
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
