import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import pg from "pg";

import {
  applyMigrations,
  applySeed,
  type ReleasableClient,
  type SqlClient,
} from "../src/migrate.ts";
import { createPgRecipeStore } from "../src/recipes/pg.ts";

const execFile = promisify(execFileCb);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsDir = join(repoRoot, "db/migrations");
const seedFile = join(repoRoot, "db/seed.sql");

const { Pool } = pg;

function clientFrom(pool: pg.Pool): {
  checkout: () => Promise<ReleasableClient>;
  sql: SqlClient;
} {
  return {
    sql: {
      async query(sql, params) {
        const result = await pool.query(sql, params);
        return { rowCount: result.rowCount, rows: result.rows };
      },
    },
    async checkout(): Promise<ReleasableClient> {
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
    },
  };
}

describe("postgres recipe facts", () => {
  let container = "";
  let pool: pg.Pool | undefined;
  const password = randomBytes(12).toString("hex");
  const port = 55433;

  before(async () => {
    container = `cookbook-facts-pg-${randomBytes(4).toString("hex")}`;
    await execFile("docker", [
      "run",
      "-d",
      "--name",
      container,
      "-e",
      "POSTGRES_PASSWORD=" + password,
      "-e",
      "POSTGRES_DB=cookbook",
      "-p",
      `127.0.0.1:${port}:5432`,
      "postgres:16.15-alpine",
    ]);
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        await execFile("docker", [
          "exec",
          container,
          "pg_isready",
          "-U",
          "postgres",
          "-d",
          "cookbook",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) {
      throw new Error("disposable postgres did not become ready");
    }
    pool = new Pool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "cookbook",
    });
    const { checkout, sql } = clientFrom(pool);
    await applyMigrations(checkout, migrationsDir);
    await applySeed(sql, seedFile);
  });

  after(async () => {
    await pool?.end();
    if (container) {
      await execFile("docker", ["rm", "-f", container]).catch(() => undefined);
    }
  });

  it(
    "persists facts in Postgres through save, list, read, and a facts-only update",
    verifies("173", "bd1814ff01f3fd65", async () => {
      assert.ok(pool);
      const store = createPgRecipeStore(clientFrom(pool).checkout);
      const created = await store.save({
        id: "pg-facts-roundtrip",
        actor: "chef",
        title: "Example: Lemon chicken bowls",
        servings: 2,
        steps: ["Cook the rice."],
        ingredients: [{ line: "Chicken · 400 g" }],
        facts: {
          primaryProtein: "chicken",
          totalMinutes: 30,
          effort: "low",
          mealTypes: ["dinner", "lunch"],
        },
      });
      assert.deepEqual(created.facts, {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["lunch", "dinner"],
      });

      const listed = await store.list();
      const row = listed.find((item) => item.id === created.id);
      assert.deepEqual(row?.facts, created.facts);

      const omitted = await store.save({
        id: created.id,
        actor: "taylor",
        title: "Example: Lemon chicken bowls",
        servings: 2,
        steps: ["Cook the rice."],
      });
      assert.deepEqual(omitted.facts, created.facts);
      assert.equal(omitted.actor, "chef");

      const patched = await store.updateFacts(created.id, {
        primaryProtein: "seitan",
        totalMinutes: 40,
        effort: "medium",
        mealTypes: ["lunch", "dinner", "snack"],
      });
      assert.equal(patched.title, "Example: Lemon chicken bowls");
      assert.deepEqual(patched.ingredients, created.ingredients);
      assert.deepEqual(patched.facts, {
        primaryProtein: "seitan",
        totalMinutes: 40,
        effort: "medium",
        mealTypes: ["lunch", "dinner", "snack"],
      });

      const reread = await store.read(created.id);
      assert.deepEqual(reread.facts, patched.facts);

      const cleared = await store.updateFacts(created.id, null);
      assert.deepEqual(cleared.facts, emptyRecipeFacts());
      const afterClear = await store.read(created.id);
      assert.deepEqual(afterClear.facts, emptyRecipeFacts());

      const applied = await pool.query(
        "SELECT id FROM schema_migrations WHERE id = $1",
        ["0003_recipe_facts.sql"],
      );
      assert.equal(applied.rowCount, 1);
      const again = await applyMigrations(clientFrom(pool).checkout, migrationsDir);
      assert.equal(again.includes("0003_recipe_facts.sql"), false);
    }),
  );
});
