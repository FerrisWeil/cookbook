import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMigrations,
  applySeed,
  type QueryResult,
  type SqlClient,
} from "../src/migrate.ts";

function memoryClient(): SqlClient & { statements: string[] } {
  const applied = new Set<string>();
  const statements: string[] = [];
  return {
    statements,
    async query(sql, params = []) {
      statements.push(sql.trim().split("\n")[0] ?? sql);
      if (sql.includes("SELECT 1 FROM schema_migrations")) {
        const id = String(params[0]);
        const rows = applied.has(id) ? [{ ok: 1 }] : [];
        return { rowCount: rows.length, rows } satisfies QueryResult;
      }
      if (sql.includes("INSERT INTO schema_migrations")) {
        applied.add(String(params[0]));
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

describe("applyMigrations", () => {
  it("applies sql files in name order and skips ones already recorded", async () => {
    const client = memoryClient();
    const files = {
      async list() {
        return ["0002_later.sql", "0001_first.sql", "readme.txt"];
      },
      async read(path: string) {
        return `-- ${path}`;
      },
    };

    const first = await applyMigrations(client, "/db", files);
    assert.deepEqual(first, ["0001_first.sql", "0002_later.sql"]);

    const second = await applyMigrations(client, "/db", files);
    assert.deepEqual(second, []);
  });
});

describe("applySeed", () => {
  it("runs the seed file", async () => {
    const client = memoryClient();
    await applySeed(client, "/db/seed.sql", {
      async list() {
        return [];
      },
      async read(path: string) {
        assert.equal(path, "/db/seed.sql");
        return "INSERT INTO app_meta (key, value) VALUES ('seeded', 'true')";
      },
    });
    assert.equal(client.statements.at(-1)?.startsWith("INSERT INTO app_meta"), true);
  });
});
