import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type QueryResult = {
  rowCount: number | null;
  rows: Array<Record<string, unknown>>;
};

export type SqlClient = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type ReleasableClient = SqlClient & {
  release: () => void;
};

export type MigrationFiles = {
  list: (dir: string) => Promise<string[]>;
  read: (path: string) => Promise<string>;
};

export const diskFiles: MigrationFiles = {
  async list(dir) {
    return readdir(dir);
  },
  async read(path) {
    return readFile(path, "utf8");
  },
};

const ensureTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
`;

async function transaction<T>(
  checkout: () => Promise<ReleasableClient>,
  fn: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await checkout();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original failure is the one callers need.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function applyMigrations(
  checkout: () => Promise<ReleasableClient>,
  dir: string,
  files: MigrationFiles = diskFiles,
): Promise<string[]> {
  await transaction(checkout, async (client) => {
    await client.query(ensureTable);
  });
  const names = (await files.list(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const name of names) {
    const sql = await files.read(join(dir, name));
    const didApply = await transaction(checkout, async (client) => {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [name],
      );
      if ((existing.rowCount ?? 0) > 0) {
        return false;
      }
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [name],
      );
      return true;
    });
    if (didApply) {
      applied.push(name);
    }
  }
  return applied;
}

export async function applySeed(
  client: SqlClient,
  seedFile: string,
  files: MigrationFiles = diskFiles,
): Promise<void> {
  const sql = await files.read(seedFile);
  await client.query(sql);
}
