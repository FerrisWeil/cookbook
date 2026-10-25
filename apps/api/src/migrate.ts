import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type QueryResult = {
  rowCount: number | null;
  rows: Array<Record<string, unknown>>;
};

export type SqlClient = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
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

export async function applyMigrations(
  client: SqlClient,
  dir: string,
  files: MigrationFiles = diskFiles,
): Promise<string[]> {
  await client.query(ensureTable);
  const names = (await files.list(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const name of names) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [name],
    );
    if ((existing.rowCount ?? 0) > 0) {
      continue;
    }
    const sql = await files.read(join(dir, name));
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [name]);
    applied.push(name);
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
