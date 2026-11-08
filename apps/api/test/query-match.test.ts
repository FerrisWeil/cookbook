import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { RECOMMENDED_PROTEINS } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import pg from "pg";

import {
  applyMigrations,
  applySeed,
  type ReleasableClient,
  type SqlClient,
} from "../src/migrate.ts";
import { createMemoryRecipeStore } from "../src/recipes/memory.ts";
import { createPgRecipeStore } from "../src/recipes/pg.ts";
import type { RecipeStore } from "../src/recipes/types.ts";
import {
  CATEGORY_NESTED_QUERY,
  FULL_LIBRARY_ORDER,
  INGREDIENT_PHRASE_QUERY,
  MULTI_INGREDIENT_QUERY,
  SPACED_QUERY,
  TIME_QUERY,
  TITLE_QUERY,
  WILDCARD_QUERY,
  listedIds,
  seedQueryLibrary,
} from "./query-fixtures.ts";

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

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

describe("library query matching", () => {
  let container = "";
  let pool: pg.Pool | undefined;
  let memory: RecipeStore;
  let postgres: RecipeStore;
  const password = randomBytes(12).toString("hex");

  before(async () => {
    memory = createMemoryRecipeStore();
    await seedQueryLibrary(memory);

    const port = await freePort();
    container = `cookbook-query-pg-${randomBytes(4).toString("hex")}`;
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
    pool = new Pool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "cookbook",
    });
    const deadline = Date.now() + 30_000;
    let last: unknown;
    while (Date.now() < deadline) {
      try {
        await pool.query("SELECT 1");
        last = undefined;
        break;
      } catch (error) {
        last = error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (last !== undefined) {
      throw last instanceof Error
        ? last
        : new Error("disposable postgres did not become ready");
    }
    const { checkout, sql } = clientFrom(pool);
    await applyMigrations(checkout, migrationsDir);
    await applySeed(sql, seedFile);
    postgres = createPgRecipeStore(checkout);
    await seedQueryLibrary(postgres);
  });

  after(async () => {
    await pool?.end();
    if (container) {
      await execFile("docker", ["rm", "-f", container]).catch(() => undefined);
    }
  });

  async function onBoth(
    fn: (store: RecipeStore, label: string) => Promise<void>,
  ): Promise<void> {
    await fn(memory, "memory");
    await fn(postgres, "postgres");
  }

  it(
    "matches a title phrase in the title and not in ingredients",
    verifies("218", "73f27bce6d821103", async () => {
    await onBoth(async (store, label) => {
      const ids = await listedIds(store, TITLE_QUERY);
      assert.deepEqual(ids, ["title-hit"], label);
      assert.equal(ids.includes("split-trap"), false, label);
    });
    }),
  );

  it(
    "keeps an ingredient phrase inside one ingredient name",
    verifies("219", "9eb55c873c616b1e", async () => {
    await onBoth(async (store, label) => {
      const ids = await listedIds(store, INGREDIENT_PHRASE_QUERY);
      assert.deepEqual(ids, ["ingredient-hit"], label);
      assert.equal(ids.includes("title-hit"), false, label);
      assert.equal(ids.includes("split-trap"), false, label);
    });
    }),
  );

  it(
    "requires every ingredient entry and allows extra ingredients",
    verifies("220", "5b431cc8f1563945", async () => {
    await onBoth(async (store, label) => {
      const ids = await listedIds(store, MULTI_INGREDIENT_QUERY);
      assert.deepEqual(ids, ["both-ings"], label);
    });
    }),
  );

  it(
    "ORs within a category and ANDs nested mixed groups",
    verifies("221", "037ae391081d9d1a", async () => {
    await onBoth(async (store, label) => {
      const ids = await listedIds(store, CATEGORY_NESTED_QUERY);
      assert.deepEqual(ids, ["lunch-bowl"], label);
      assert.equal(ids.includes("dinner-bowl"), false, label);
      assert.equal(ids.includes("lunch-stew"), false, label);
    });
    }),
  );

  it(
    "includes 30 minutes and excludes unknown totals when the time filter is active",
    verifies("222", "8acf370eb4264293", async () => {
    await onBoth(async (store, label) => {
      const ids = await listedIds(store, TIME_QUERY);
      assert.deepEqual(ids, ["fast-30"], label);
      assert.equal(ids.includes("slow-31"), false, label);
      assert.equal(ids.includes("unknown-time"), false, label);
      const all = await listedIds(store, null);
      assert.ok(all.includes("unknown-time"), label);
      assert.ok(all.includes("no-facts"), label);
    });
    }),
  );

  it(
    "returns the full visible library in saved order when the query is empty",
    verifies("223", "1a97901675348180", async () => {
    await onBoth(async (store, label) => {
      assert.deepEqual(await listedIds(store, null), FULL_LIBRARY_ORDER, label);
      assert.equal((await listedIds(store, null)).includes("hidden-query"), false, label);
    });
    }),
  );

  it(
    "applies the same whitespace collapse on stored titles",
    verifies("224", "13bf081deb973b7a", async () => {
    await onBoth(async (store, label) => {
      assert.deepEqual(await listedIds(store, SPACED_QUERY), ["spaced-title"], label);
    });
    }),
  );

  it(
    "treats percent, underscore, and backslash as literals in Postgres and memory",
    verifies("225", "cc7290e3d2eca51e", async () => {
    await onBoth(async (store, label) => {
      assert.deepEqual(await listedIds(store, WILDCARD_QUERY), ["wildcard-title"], label);
    });
    }),
  );

  it(
    "builds protein choices from the full library plus recommendations",
    verifies("230", "e5e631eab715e1f6", async () => {
    await onBoth(async (store, label) => {
      const filtered = await store.list(TITLE_QUERY);
      assert.deepEqual(
        filtered.map((item) => item.id),
        ["title-hit"],
        label,
      );
      const choices = await store.proteinChoices();
      for (const recommended of RECOMMENDED_PROTEINS) {
        assert.ok(choices.includes(recommended), `${label} ${recommended}`);
      }
      assert.ok(choices.includes("seitan"), label);
      assert.ok(choices.indexOf("chicken") < choices.indexOf("seitan"), label);
    });
    }),
  );
});
