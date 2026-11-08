import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import pg from "pg";

import { MutationAckError } from "../src/mutations.ts";
import {
  applyMigrations,
  applySeed,
  type ReleasableClient,
  type SqlClient,
} from "../src/migrate.ts";
import { createPgRecipeStore } from "../src/recipes/pg.ts";
import { SessionError } from "../src/sessions/error.ts";
import { createPgSessionStore } from "../src/sessions/pg.ts";

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

describe("postgres recipe facts", () => {
  let container = "";
  let pool: pg.Pool | undefined;
  const password = randomBytes(12).toString("hex");

  before(async () => {
    const port = await freePort();
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
        mutationId: "pg-facts-1",
        fields: {
          primaryProtein: "seitan",
          totalMinutes: 40,
          effort: "medium",
          mealTypes: ["lunch", "dinner", "snack"],
        },
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

      const cleared = await store.updateFacts(created.id, {
        mutationId: "pg-facts-clear",
        fields: null,
      });
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

  it("applies a facts patch in the same transaction as the mutation ack", async () => {
    assert.ok(pool);
    const store = createPgRecipeStore(clientFrom(pool).checkout);
    const created = await store.save({
      actor: "chef",
      title: "Example: Acked facts",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    const proteinOnly = await store.updateFacts(created.id, {
      mutationId: "pg-omit",
      fields: { primaryProtein: "seitan" },
    });
    assert.deepEqual(proteinOnly.facts, {
      primaryProtein: "seitan",
      totalMinutes: 30,
      effort: "low",
      mealTypes: ["dinner"],
    });
    await store.save({
      id: created.id,
      actor: "chef",
      title: "Example: Acked facts",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "tofu",
        totalMinutes: 45,
        effort: "high",
        mealTypes: ["lunch"],
      },
    });
    const replay = await store.updateFacts(created.id, {
      mutationId: "pg-omit",
      fields: { primaryProtein: "seitan" },
    });
    assert.equal(replay.facts.primaryProtein, "tofu");
    assert.equal(replay.facts.totalMinutes, 45);
    await assert.rejects(
      () =>
        store.updateFacts(created.id, {
          mutationId: "pg-omit",
          fields: { primaryProtein: "beef" },
        }),
      (error: unknown) => error instanceof MutationAckError,
    );
    const acked = await pool.query(
      "SELECT payload_fingerprint FROM recipe_mutation_acks WHERE mutation_id = $1",
      ["pg-omit"],
    );
    assert.equal(acked.rowCount, 1);
    const applied = await pool.query(
      "SELECT id FROM schema_migrations WHERE id = $1",
      ["0004_recipe_mutation_acks.sql"],
    );
    assert.equal(applied.rowCount, 1);
  });

  it("serializes overlapping facts patches so omitted fields are not restored", async () => {
    assert.ok(pool);
    const store = createPgRecipeStore(clientFrom(pool).checkout);
    const created = await store.save({
      actor: "chef",
      title: "Example: Concurrent facts",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    await Promise.all([
      store.updateFacts(created.id, {
        mutationId: "pg-concurrent-protein",
        fields: { primaryProtein: "seitan" },
      }),
      store.updateFacts(created.id, {
        mutationId: "pg-concurrent-time",
        fields: { totalMinutes: 40 },
      }),
    ]);
    const read = await store.read(created.id);
    assert.equal(read.facts.primaryProtein, "seitan");
    assert.equal(read.facts.totalMinutes, 40);
    assert.equal(read.facts.effort, "low");
  });

  it("returns 200 twice for concurrent same-id same-target patches with one effect", async () => {
    assert.ok(pool);
    const store = createPgRecipeStore(clientFrom(pool).checkout);
    const created = await store.save({
      actor: "chef",
      title: "Example: Same mutation",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    const body = {
      mutationId: "pg-same-id",
      fields: { primaryProtein: "seitan" },
    };
    const [first, second] = await Promise.all([
      store.updateFacts(created.id, body),
      store.updateFacts(created.id, body),
    ]);
    assert.equal(first.facts.primaryProtein, "seitan");
    assert.equal(second.facts.primaryProtein, "seitan");
    const acked = await pool.query(
      "SELECT recipe_id FROM recipe_mutation_acks WHERE mutation_id = $1",
      ["pg-same-id"],
    );
    assert.equal(acked.rowCount, 1);
    assert.equal(acked.rows[0]?.["recipe_id"], created.id);
  });

  it("rejects a concurrent same-id different payload and a different recipe", async () => {
    assert.ok(pool);
    const store = createPgRecipeStore(clientFrom(pool).checkout);
    const created = await store.save({
      actor: "chef",
      title: "Example: Mismatch mutation",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    const other = await store.save({
      actor: "chef",
      title: "Example: Other mutation",
      servings: 2,
      steps: ["Cook."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    const results = await Promise.allSettled([
      store.updateFacts(created.id, {
        mutationId: "pg-conflict-id",
        fields: { primaryProtein: "seitan" },
      }),
      store.updateFacts(created.id, {
        mutationId: "pg-conflict-id",
        fields: { primaryProtein: "beef" },
      }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected[0]?.status === "rejected" &&
        rejected[0].reason instanceof MutationAckError,
      true,
    );
    const winner =
      fulfilled[0]?.status === "fulfilled" ? fulfilled[0].value.facts.primaryProtein : "";
    assert.equal(winner === "seitan" || winner === "beef", true);
    const stored = await store.read(created.id);
    assert.equal(stored.facts.primaryProtein, winner);
    await assert.rejects(
      () =>
        store.updateFacts(other.id, {
          mutationId: "pg-conflict-id",
          fields: { primaryProtein: winner },
        }),
      (error: unknown) => error instanceof MutationAckError,
    );
    const otherRead = await store.read(other.id);
    assert.equal(otherRead.facts.primaryProtein, "chicken");
  });

  it("stores one active cooking session and keeps its snapshot", async () => {
    assert.ok(pool);
    const recipes = createPgRecipeStore(clientFrom(pool).checkout);
    const sessions = createPgSessionStore(clientFrom(pool).checkout);
    const created = await recipes.save({
      id: "pg-session-soup",
      actor: "chef",
      title: "Example: Soup",
      servings: 2,
      steps: ["Chop.", "Simmer."],
      ingredients: [{ line: "1 onion" }],
    });
    const loadSnapshot = async () => {
      const recipe = await recipes.read(created.id);
      return {
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients.map((item) => item.line),
        steps: [...recipe.steps],
      };
    };
    const started = await sessions.start({
      mutationId: "pg-session-start",
      recipeId: created.id,
      loadSnapshot,
    });
    const retry = await sessions.start({
      mutationId: "pg-session-start",
      recipeId: created.id,
      loadSnapshot,
    });
    assert.equal(retry.id, started.id);
    await assert.rejects(
      sessions.start({
        mutationId: "pg-session-other",
        recipeId: created.id,
        loadSnapshot,
      }),
      (error: unknown) => error instanceof SessionError && error.code === "active",
    );
    await recipes.save({
      id: created.id,
      actor: "chef",
      title: "Example: Stew",
      servings: 4,
      steps: ["Brown."],
      ingredients: [{ line: "2 carrots" }],
    });
    const active = await sessions.resume();
    assert.equal(active?.snapshot.title, "Example: Soup");
    assert.deepEqual(active?.snapshot.steps, ["Chop.", "Simmer."]);
    assert.deepEqual(active?.snapshot.ingredients, ["1 onion"]);
    const shown = await sessions.display({
      mutationId: "pg-session-show",
      sessionId: started.id,
      step: 1,
    });
    const done = await sessions.complete({
      mutationId: "pg-session-done",
      sessionId: started.id,
      step: 0,
    });
    assert.equal(shown.displayedStep, 1);
    assert.deepEqual(shown.completedSteps, []);
    assert.equal(done.displayedStep, 1);
    assert.deepEqual(done.completedSteps, [0]);
    const again = await sessions.complete({
      mutationId: "pg-session-done",
      sessionId: started.id,
      step: 0,
    });
    assert.deepEqual(again.completedSteps, [0]);
    await sessions.finish({ mutationId: "pg-session-finish", sessionId: started.id });
    assert.equal(await sessions.resume(), null);
    await assert.rejects(
      sessions.complete({
        mutationId: "pg-session-late",
        sessionId: started.id,
        step: 0,
      }),
      (error: unknown) => error instanceof SessionError && error.code === "ended",
    );
    const raced = await Promise.allSettled([
      sessions.start({ mutationId: "pg-race-a", recipeId: created.id, loadSnapshot }),
      sessions.start({ mutationId: "pg-race-b", recipeId: created.id, loadSnapshot }),
    ]);
    const won = raced.find((item) => item.status === "fulfilled");
    const lost = raced.find((item) => item.status === "rejected");
    assert.equal(won?.status, "fulfilled");
    assert.equal(lost?.status, "rejected");
    assert.ok(
      lost?.status === "rejected" &&
        lost.reason instanceof SessionError &&
        lost.reason.code === "active",
    );
    const racedSession = won?.status === "fulfilled" ? won.value : null;
    assert.ok(racedSession);
    const activeCount = await pool.query(
      "SELECT count(*)::int AS n FROM cooking_sessions WHERE status = 'active' AND recipe_id = $1",
      [created.id],
    );
    assert.equal(activeCount.rows[0]?.n, 1);
    const duplicated = await Promise.all([
      sessions.complete({ mutationId: "pg-race-step", sessionId: racedSession.id, step: 0 }),
      sessions.complete({ mutationId: "pg-race-step", sessionId: racedSession.id, step: 0 }),
    ]);
    assert.deepEqual(duplicated[0]?.completedSteps, [0]);
    assert.deepEqual(duplicated[1]?.completedSteps, [0]);
    const stored = await sessions.resume();
    assert.deepEqual(stored?.completedSteps, [0]);
    await sessions.finish({ mutationId: "pg-race-finish", sessionId: racedSession.id });
    const late = await Promise.allSettled([
      sessions.complete({ mutationId: "pg-race-late", sessionId: racedSession.id, step: 1 }),
      sessions.start({ mutationId: "pg-race-a", recipeId: created.id, loadSnapshot }),
    ]);
    assert.equal(late.length, 2);
    for (const item of late) {
      assert.equal(item.status, "rejected");
      assert.ok(
        item.status === "rejected" &&
          item.reason instanceof SessionError &&
          item.reason.code === "ended",
      );
    }
    assert.equal(await sessions.resume(), null);
    const after = await pool.query(
      "SELECT count(*)::int AS n FROM cooking_sessions WHERE status = 'active' AND recipe_id = $1",
      [created.id],
    );
    assert.equal(after.rows[0]?.n, 0);
  });
});
