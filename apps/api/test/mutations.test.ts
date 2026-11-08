import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyWithAck,
  canonicalFingerprint,
  MutationAckError,
} from "../src/mutations.ts";
import type { SqlClient } from "../src/migrate.ts";

function memoryAcks(): SqlClient & { applied: string[] } {
  const rows = new Map<
    string,
    { payload_fingerprint: string; recipe_id: string }
  >();
  const applied: string[] = [];
  return {
    applied,
    async query(sql, params = []) {
      if (sql.includes("pg_advisory_xact_lock")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("SELECT payload_fingerprint")) {
        const mutationId = String(params[0]);
        const row = rows.get(mutationId);
        return {
          rowCount: row ? 1 : 0,
          rows: row ? [row] : [],
        };
      }
      if (sql.includes("INSERT INTO recipe_mutation_acks")) {
        rows.set(String(params[0]), {
          payload_fingerprint: String(params[1]),
          recipe_id: String(params[2]),
        });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(sql);
    },
  };
}

describe("mutation acknowledgements", () => {
  it("applies a new mutation id once and treats a retry with the same payload as a duplicate", async () => {
    const client = memoryAcks();
    const input = {
      mutationId: "mut-1",
      payloadFingerprint: canonicalFingerprint({ title: "Soup" }),
      recipeId: "r1",
    };
    const first = await applyWithAck(client, input, async () => {
      client.applied.push("effect");
    });
    const second = await applyWithAck(client, input, async () => {
      client.applied.push("again");
    });
    assert.equal(first.kind, "applied");
    assert.equal(second.kind, "duplicate");
    assert.deepEqual(client.applied, ["effect"]);
  });

  it("rejects the same mutation id against a different recipe", async () => {
    const client = memoryAcks();
    await applyWithAck(
      client,
      {
        mutationId: "mut-1",
        payloadFingerprint: canonicalFingerprint({ primaryProtein: "seitan" }),
        recipeId: "r1",
      },
      async () => {
        client.applied.push("r1");
      },
    );
    await assert.rejects(
      () =>
        applyWithAck(
          client,
          {
            mutationId: "mut-1",
            payloadFingerprint: canonicalFingerprint({
              primaryProtein: "seitan",
            }),
            recipeId: "r2",
          },
          async () => {
            client.applied.push("r2");
          },
        ),
      (error: unknown) => error instanceof MutationAckError,
    );
    assert.deepEqual(client.applied, ["r1"]);
  });

  it("rejects the same mutation id with a different payload", async () => {
    const client = memoryAcks();
    await applyWithAck(
      client,
      {
        mutationId: "mut-1",
        payloadFingerprint: canonicalFingerprint({ title: "Soup" }),
        recipeId: "r1",
      },
      async () => {
        client.applied.push("effect");
      },
    );
    await assert.rejects(
      () =>
        applyWithAck(
          client,
          {
            mutationId: "mut-1",
            payloadFingerprint: canonicalFingerprint({ title: "Stew" }),
            recipeId: "r1",
          },
          async () => {
            client.applied.push("again");
          },
        ),
      (error: unknown) => error instanceof MutationAckError,
    );
    assert.deepEqual(client.applied, ["effect"]);
  });

  it("does not record an ack when the effect throws", async () => {
    const client = memoryAcks();
    await assert.rejects(
      () =>
        applyWithAck(
          client,
          {
            mutationId: "mut-1",
            payloadFingerprint: "fp",
            recipeId: "r1",
          },
          async () => {
            throw new Error("constraint");
          },
        ),
      /constraint/,
    );
    const retry = await applyWithAck(
      client,
      {
        mutationId: "mut-1",
        payloadFingerprint: "fp",
        recipeId: "r1",
      },
      async () => {
        client.applied.push("effect");
      },
    );
    assert.equal(retry.kind, "applied");
    assert.deepEqual(client.applied, ["effect"]);
  });

  it("survives a process restart with the same stored ack row", async () => {
    const client = memoryAcks();
    const input = {
      mutationId: "mut-1",
      payloadFingerprint: "fp",
      recipeId: "r1",
    };
    await applyWithAck(client, input, async () => {
      client.applied.push("first-process");
    });
    const afterRestart = await applyWithAck(client, input, async () => {
      client.applied.push("second-process");
    });
    assert.equal(afterRestart.kind, "duplicate");
    assert.deepEqual(client.applied, ["first-process"]);
  });
});
