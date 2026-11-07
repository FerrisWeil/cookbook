import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acknowledge,
  enqueue,
  markFailed,
  markInflight,
  nextSendable,
  requeue,
  scheduleRetry,
  supersededIds,
  type QueueItem,
} from "../src/sync/queue.ts";
import {
  overlayList,
  overlayRecord,
  overlayRecipe,
} from "../src/sync/overlay.ts";
import { backoffMs, classifySendResult } from "../src/sync/retry.ts";
import { payloadFingerprint } from "../src/sync/fingerprint.ts";
import { Outbox } from "../src/sync/outbox.ts";
import {
  memoryLock,
  memoryStorage,
  type NetworkPort,
  type SendResult,
} from "../src/sync/ports.ts";
import type { Mutation } from "../src/sync/types.ts";

function mutation(
  id: string,
  fields: Mutation["fields"],
  recipeId = "r1",
): Mutation {
  return { id, recipeId, fields };
}

function queued(mut: Mutation, extra: Partial<QueueItem> = {}): QueueItem {
  return { mutation: mut, status: "queued", attempts: 0, ...extra };
}

describe("payload fingerprint", () => {
  it("is equal for the same fields regardless of key order", () => {
    assert.equal(
      payloadFingerprint({ title: "Soup", servings: 2 }),
      payloadFingerprint({ servings: 2, title: "Soup" }),
    );
  });

  it("differs when a field value differs", () => {
    assert.notEqual(
      payloadFingerprint({ title: "Soup" }),
      payloadFingerprint({ title: "Stew" }),
    );
  });
});

describe("queue order and identity", () => {
  it("appends mutations in enqueue order and never drops them by age", () => {
    const first = enqueue([], mutation("m1", { title: "A" }));
    const second = enqueue(first, mutation("m2", { servings: 2 }));
    const aged = second.map((item) => ({ ...item, attempts: 99 }));
    assert.deepEqual(
      aged.map((item) => item.mutation.id),
      ["m1", "m2"],
    );
    assert.equal(nextSendable(aged, 0)?.mutation.id, "m1");
  });

  it("removes a mutation by id on ack and leaves later ones", () => {
    const items = enqueue(
      enqueue([], mutation("m1", { title: "A" })),
      mutation("m2", { title: "B" }),
    );
    const remaining = acknowledge(items, "m1");
    assert.deepEqual(
      remaining.map((item) => item.mutation.id),
      ["m2"],
    );
  });

  it("does not send a mutation whose fields were all written later on this device", () => {
    const items = [
      queued(mutation("old", { title: "A" })),
      queued(mutation("new", { title: "B" })),
    ];
    assert.deepEqual([...supersededIds(items)], ["old"]);
    assert.equal(nextSendable(items, 0)?.mutation.id, "new");
  });

  it("does not drop a pending write because another recipe used the same field name", () => {
    const items = enqueue(
      enqueue([], mutation("m1", { title: "Soup" }, "r1")),
      mutation("m2", { title: "Stew" }, "r2"),
    );
    assert.deepEqual(
      items.map((item) => item.mutation.id),
      ["m1", "m2"],
    );
    assert.equal(nextSendable(items, 0)?.mutation.id, "m1");
  });

  it("still sends an older mutation that writes a field a later one does not", () => {
    const items = [
      queued(mutation("old", { title: "A", servings: 2 })),
      queued(mutation("new", { title: "B" })),
    ];
    assert.equal(supersededIds(items).has("old"), false);
    assert.equal(nextSendable(items, 0)?.mutation.id, "old");
  });

  it("does not skip an inflight mutation even if a later one overwrites its fields", () => {
    const items = [
      queued(mutation("old", { title: "A" }), { status: "inflight" }),
      queued(mutation("new", { title: "B" })),
    ];
    assert.equal(nextSendable(items, 0)?.mutation.id, "old");
  });
});

describe("overlay and rebase", () => {
  it("applies pending field patches in queue order over a snapshot", () => {
    const snapshot = { title: "Base", servings: 4, tags: ["keep"] };
    const pending = [
      mutation("m1", { title: "One" }),
      mutation("m2", { servings: 2 }),
    ];
    assert.deepEqual(overlayRecord(snapshot, pending, null), {
      title: "One",
      servings: 2,
      tags: ["keep"],
    });
  });

  it("keeps an unsaved draft over pending and snapshot for the same field", () => {
    const snapshot = { title: "Saved", servings: 4 };
    const pending = [mutation("m1", { title: "Pending" })];
    assert.deepEqual(overlayRecord(snapshot, pending, { title: "Draft" }), {
      title: "Draft",
      servings: 4,
    });
  });

  it("replaces an array field as a whole value, not by index", () => {
    const snapshot = {
      title: "Stew",
      ingredients: ["old a", "old b", "old c"],
    };
    const pending = [
      mutation("m1", { ingredients: ["new a", "new b"] }),
    ];
    assert.deepEqual(overlayRecipe(snapshot, pending, null).ingredients, [
      "new a",
      "new b",
    ]);
  });

  it("rebases a newer snapshot under pending work without dropping later edits", () => {
    const snapshot = { title: "Chef", servings: 8 };
    const pending = [mutation("m1", { title: "Mine" })];
    const draft = { servings: 3 };
    assert.deepEqual(overlayRecord(snapshot, pending, draft), {
      title: "Mine",
      servings: 3,
    });
  });

  it("overlays list titles from pending mutations and leaves other rows alone", () => {
    const list = [
      { id: "r1", title: "Old" },
      { id: "r2", title: "Other" },
    ];
    const pending = [mutation("m1", { title: "New" }, "r1")];
    assert.deepEqual(overlayList(list, pending), [
      { id: "r1", title: "New" },
      { id: "r2", title: "Other" },
    ]);
  });

  it("keeps the latest failed patch in the overlay so the typed value is not discarded", () => {
    const snapshot = { title: "Saved" };
    const pending = [mutation("old", { title: "Needs attention" })];
    assert.equal(
      overlayRecord(snapshot, pending, null).title,
      "Needs attention",
    );
  });

  it("does not let a failed older mutation roll back a later success", () => {
    const items = [
      queued(mutation("old", { title: "Stale" }), {
        status: "failed",
        failure: { kind: "permanent", message: "rejected" },
      }),
      queued(mutation("new", { title: "Later" })),
    ];
    const remaining = acknowledge(items, "new");
    assert.equal(remaining.length, 0);
    assert.deepEqual(
      overlayRecord({ title: "Later won" }, remaining.map((item) => item.mutation), null),
      { title: "Later won" },
    );
  });
});

describe("retry policy", () => {
  it("treats transport and server faults as transient", () => {
    assert.equal(classifySendResult({ ok: false, kind: "transient", message: "down" }), "transient");
    assert.equal(backoffMs(0), 1000);
    assert.equal(backoffMs(1), 2000);
    assert.equal(backoffMs(8), 30_000);
  });

  it("treats validation and permission failures as permanent", () => {
    assert.equal(
      classifySendResult({ ok: false, kind: "permanent", message: "invalid" }),
      "permanent",
    );
  });

  it("does not send a permanently failed item again", () => {
    const items = [
      markFailed(
        [queued(mutation("m1", { title: "" }))],
        "m1",
        { kind: "permanent", message: "A title is required." },
      )[0]!,
      queued(mutation("m2", { title: "Ok" })),
    ];
    assert.equal(nextSendable(items, 0)?.mutation.id, "m2");
  });

  it("requeues an inflight item without scheduling a retry instant", () => {
    const items = requeue(
      markInflight([queued(mutation("m1", { title: "A" }))], "m1"),
      "m1",
    );
    assert.equal(items[0]?.status, "queued");
    assert.equal(items[0]?.nextAttemptAt, undefined);
    assert.equal(nextSendable(items, 0)?.mutation.id, "m1");
  });

  it("waits until the retry instant before sending a transient item again", () => {
    const retried = scheduleRetry(
      markInflight([queued(mutation("m1", { title: "A" }))], "m1"),
      "m1",
      5_000,
    );
    assert.equal(nextSendable(retried, 4_999)?.mutation.id, undefined);
    assert.equal(nextSendable(retried, 5_000)?.mutation.id, "m1");
  });
});

function networkWith(
  handler: (mutation: Mutation) => Promise<SendResult>,
): NetworkPort {
  return { send: handler };
}

describe("outbox driver", () => {
  it("replays durable queued mutations after a new driver is created", async () => {
    const storage = memoryStorage();
    const sent: string[] = [];
    const network = networkWith(async (mut) => {
      sent.push(mut.id);
      return { ok: true, kind: "applied" };
    });
    const first = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await first.enqueue(mutation("m1", { title: "A" }));
    const second = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await second.drain();
    assert.deepEqual(sent, ["m1"]);
    assert.equal((await storage.load()).length, 0);
  });

  it("does not enqueue credentials or extra metadata in storage", async () => {
    const storage = memoryStorage();
    const outbox = new Outbox({
      storage,
      network: networkWith(async () => ({ ok: true, kind: "applied" })),
      lock: memoryLock(),
      now: () => 0,
    });
    await outbox.enqueue(mutation("m1", { title: "A" }));
    const dumped = JSON.stringify(await storage.load());
    assert.equal(dumped.includes("Bearer"), false);
    assert.equal(dumped.includes("token"), false);
    assert.equal(dumped.includes("authorization"), false);
    assert.match(dumped, /"title":"A"/);
  });

  it("serializes sends so two drainers do not double-send or reorder", async () => {
    const storage = memoryStorage();
    const lock = memoryLock();
    const sent: string[] = [];
    let releaseFirst!: () => void;
    const firstSend = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const network = networkWith(async (mut) => {
      sent.push(`start:${mut.id}`);
      if (mut.id === "m1") {
        await firstSend;
      }
      sent.push(`end:${mut.id}`);
      return { ok: true, kind: "applied" };
    });
    const outbox = new Outbox({ storage, network, lock, now: () => 0 });
    await outbox.enqueue(mutation("m1", { title: "A" }));
    await outbox.enqueue(mutation("m2", { servings: 2 }));
    const draining = Promise.all([outbox.drain(), outbox.drain()]);
    await Promise.resolve();
    releaseFirst();
    await draining;
    assert.deepEqual(sent, ["start:m1", "end:m1", "start:m2", "end:m2"]);
  });

  it("treats a lost ack with the same payload as success and does not resend after", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const network = networkWith(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, kind: "duplicate" };
      }
      throw new Error("should not send again");
    });
    const outbox = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await outbox.enqueue(mutation("m1", { title: "A" }));
    await outbox.drain();
    await outbox.drain();
    assert.equal(calls, 1);
    assert.equal((await storage.load()).length, 0);
  });

  it("skips an older superseded mutation and sends the newer same-field write", async () => {
    const storage = memoryStorage();
    const sent: string[] = [];
    const network = networkWith(async (mut) => {
      sent.push(`${mut.id}:${String(mut.fields["title"])}`);
      return { ok: true, kind: "applied" };
    });
    const outbox = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await outbox.enqueue(mutation("old", { title: "A" }));
    await outbox.enqueue(mutation("new", { title: "B" }));
    await outbox.drain();
    assert.deepEqual(sent, ["new:B"]);
    assert.equal((await storage.load()).length, 0);
  });

  it("keeps a permanently rejected mutation and does not retry it", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const network = networkWith(async () => {
      calls += 1;
      return { ok: false, kind: "permanent", message: "A title is required." };
    });
    const outbox = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await outbox.enqueue(mutation("m1", { title: "" }));
    await outbox.drain();
    await outbox.drain();
    assert.equal(calls, 1);
    const items = await storage.load();
    assert.equal(items[0]?.status, "failed");
    assert.equal(items[0]?.failure?.kind, "permanent");
    assert.equal(outbox.status().failed, 1);
    assert.equal(outbox.status().pending, 0);
  });

  it("retries a transient failure after backoff and does not mark it failed", async () => {
    const storage = memoryStorage();
    let now = 0;
    let calls = 0;
    const network = networkWith(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, kind: "transient", message: "unavailable" };
      }
      return { ok: true, kind: "applied" };
    });
    const outbox = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => now,
    });
    await outbox.enqueue(mutation("m1", { title: "A" }));
    await outbox.drain();
    assert.equal(calls, 1);
    assert.equal(outbox.status().pending, 1);
    assert.equal(outbox.status().failed, 0);
    assert.equal(outbox.nextRetryAt(), 1_000);
    await outbox.drain();
    assert.equal(calls, 1);
    now = 1_000;
    await outbox.drain();
    assert.equal(calls, 2);
    assert.equal((await storage.load()).length, 0);
  });

  it("leaves items queued without retrying when the mutation route is unavailable", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const network = networkWith(async () => {
      calls += 1;
      return { ok: false, kind: "unavailable", message: "no mutation route" };
    });
    const outbox = new Outbox({
      storage,
      network,
      lock: memoryLock(),
      now: () => 0,
    });
    await outbox.enqueue(mutation("m1", { title: "A" }));
    await outbox.drain();
    assert.equal(calls, 1);
    assert.equal(outbox.nextRetryAt(), undefined);
    await outbox.drain();
    assert.equal(calls, 2);
    assert.equal((await storage.load())[0]?.status, "queued");
    assert.equal(outbox.status().pending, 1);
    assert.equal(outbox.status().failed, 0);
  });
});
