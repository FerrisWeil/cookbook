import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMigrations,
  applySeed,
  type QueryResult,
  type ReleasableClient,
  type SqlClient,
} from "../src/migrate.ts";

function memoryDb() {
  const applied = new Set<string>();
  const log: string[] = [];
  let releases = 0;
  let nextId = 0;
  return {
    applied,
    log,
    releaseCount: () => releases,
    async checkout(): Promise<ReleasableClient> {
      const id = ++nextId;
      const pending = new Set<string>();
      let released = false;
      return {
        release() {
          if (!released) {
            released = true;
            releases += 1;
          }
        },
        async query(sql, params = []) {
          if (released) {
            throw new Error("query on a released connection");
          }
          const first = sql.trim().split("\n")[0] ?? sql;
          log.push(`${id} ${first}`);
          if (first === "COMMIT") {
            for (const migrationId of pending) {
              applied.add(migrationId);
            }
            pending.clear();
            return { rowCount: 0, rows: [] };
          }
          if (first === "ROLLBACK") {
            pending.clear();
            return { rowCount: 0, rows: [] };
          }
          if (first === "BEGIN") {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes("SELECT 1 FROM schema_migrations")) {
            const migrationId = String(params[0]);
            const rows = applied.has(migrationId) ? [{ ok: 1 }] : [];
            return { rowCount: rows.length, rows } satisfies QueryResult;
          }
          if (sql.includes("INSERT INTO schema_migrations")) {
            pending.add(String(params[0]));
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes("BROKEN")) {
            throw new Error("migration sql failed");
          }
          return { rowCount: 0, rows: [] };
        },
      };
    },
  };
}

function memoryClient(): SqlClient & { statements: string[] } {
  const statements: string[] = [];
  return {
    statements,
    async query(sql) {
      statements.push(sql.trim().split("\n")[0] ?? sql);
      return { rowCount: 0, rows: [] };
    },
  };
}

describe("applyMigrations", () => {
  it("req:6.5.1 applies each file on one connection and skips ones already recorded", async () => {
    const db = memoryDb();
    const files = {
      async list() {
        return ["0002_later.sql", "0001_first.sql", "readme.txt"];
      },
      async read(path: string) {
        return `-- ${path}`;
      },
    };

    const first = await applyMigrations(db.checkout, "/db", files);
    assert.deepEqual(first, ["0001_first.sql", "0002_later.sql"]);
    assert.deepEqual([...db.applied], ["0001_first.sql", "0002_later.sql"]);
    assert.equal(db.releaseCount(), 3);

    const fileOne = db.log.filter((line) => line.startsWith("2 "));
    assert.deepEqual(
      fileOne.map((line) => line.slice(2)),
      [
        "BEGIN",
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        "-- /db/0001_first.sql",
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        "COMMIT",
      ],
    );

    const second = await applyMigrations(db.checkout, "/db", files);
    assert.deepEqual(second, []);
    assert.equal(
      db.log.some((line) => line.includes("INSERT") && line.startsWith("5 ")),
      false,
    );
  });

  it("does not record the id when the migration sql fails", async () => {
    const db = memoryDb();
    const files = {
      async list() {
        return ["0001_ok.sql", "0002_bad.sql"];
      },
      async read(path: string) {
        return path.endsWith("0002_bad.sql") ? "BROKEN" : "-- ok";
      },
    };

    await assert.rejects(
      () => applyMigrations(db.checkout, "/db", files),
      /migration sql failed/,
    );
    assert.deepEqual([...db.applied], ["0001_ok.sql"]);
    assert.equal(
      db.log.some((line) => line.includes("0002_bad") && line.includes("INSERT")),
      false,
    );
    assert.equal(
      db.log.some((line) => line.startsWith("3 ") && line.endsWith("ROLLBACK")),
      true,
    );
    assert.equal(db.releaseCount(), 3);
  });
});

describe("applySeed", () => {
  it("req:6.5.2 runs the seed file", async () => {
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
