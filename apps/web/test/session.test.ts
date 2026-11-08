import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRecipeFacts } from "@cookbook/shared";

import { memoryLock, memoryStorage, type NetworkPort } from "../src/sync/ports.ts";
import {
  createKitchenSession,
  type KitchenPorts,
  type RecipeReader,
  type RecipeSnapshot,
  type StreamHandlers,
  type StreamPort,
} from "../src/sync/session.ts";

type RecipeRow = RecipeSnapshot;

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function makeHarness(network?: NetworkPort) {
  const recipes = new Map<string, RecipeRow>([
    [
      "r1",
      {
        title: "Alpha",
        ingredients: ["salt"],
        steps: ["mix"],
        facts: emptyRecipeFacts(),
      },
    ],
  ]);
  let list = [{ id: "r1", title: "Alpha", facts: emptyRecipeFacts() }];
  let handlers: StreamHandlers | undefined;
  const stream: StreamPort = {
    connect(next) {
      handlers = next;
    },
  };
  const reader: RecipeReader = {
    async list() {
      return list.map((item) => ({ ...item }));
    },
    async read(id) {
      const row = recipes.get(id);
      if (!row) {
        throw new Error("The recipe was not found.");
      }
      return {
        title: row.title,
        ingredients: [...row.ingredients],
        steps: [...row.steps],
        facts: { ...row.facts, mealTypes: [...row.facts.mealTypes] },
      };
    },
  };
  const ports: KitchenPorts = {
    storage: memoryStorage(),
    lock: memoryLock(),
    network: network ?? {
      async send() {
        return { ok: true, kind: "applied" };
      },
    },
    stream,
    recipes: reader,
    now: () => 0,
    id: () => "mut-1",
  };
  return {
    ports,
    handlers: () => handlers,
    setList(next: { id: string; title: string; facts?: ReturnType<typeof emptyRecipeFacts> }[]) {
      list = next.map((item) => ({
        id: item.id,
        title: item.title,
        facts: item.facts ?? emptyRecipeFacts(),
      }));
    },
    setRecipe(id: string, row: RecipeRow) {
      recipes.set(id, row);
    },
  };
}

describe("kitchen session", () => {
  it("loads the list once and refetches without returning to loading", async () => {
    const harness = makeHarness();
    const session = createKitchenSession(harness.ports);
    const kinds: string[] = [];
    session.subscribe(() => {
      kinds.push(session.list().kind);
    });
    const starting = session.start();
    assert.equal(session.list().kind, "loading");
    await starting;
    assert.equal(session.list().kind, "ready");
    harness.setList([{ id: "r1", title: "Updated" }]);
    await session.refetch();
    assert.equal(
      kinds.includes("loading"),
      false,
      "refetch must not remount the list through loading",
    );
    const ready = session.list();
    assert.equal(ready.kind, "ready");
    if (ready.kind === "ready") {
      assert.equal(ready.recipes[0]?.title, "Updated");
    }
  });

  it("keeps an unsaved draft when a live snapshot arrives", async () => {
    const harness = makeHarness();
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.openRecipe("r1");
    session.setDraft("r1", { title: "My draft" });
    harness.setRecipe("r1", {
      title: "Chef title",
      ingredients: ["pepper"],
      steps: ["wait"],
      facts: emptyRecipeFacts(),
    });
    await session.refetch();
    const view = session.recipe("r1");
    assert.equal(view.kind, "ready");
    if (view.kind === "ready") {
      assert.equal(view.recipe.title, "My draft");
      assert.deepEqual(view.recipe.ingredients, ["pepper"]);
      assert.deepEqual(view.recipe.steps, ["wait"]);
    }
  });

  it("shows pending titles on the list until they confirm", async () => {
    const gate = deferred<void>();
    const harness = makeHarness({
      async send() {
        await gate.promise;
        return { ok: true, kind: "applied" };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    const saving = session.saveFields("r1", { title: "Pending title" });
    await saving;
    const list = session.list();
    assert.equal(list.kind, "ready");
    if (list.kind === "ready") {
      assert.equal(list.recipes[0]?.title, "Pending title");
    }
    gate.resolve();
    await saving;
  });

  it("does not loop a permanent reject and keeps the failed fields visible", async () => {
    let calls = 0;
    const harness = makeHarness({
      async send() {
        calls += 1;
        return { ok: false, kind: "permanent", message: "A title is required." };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.saveFields("r1", { title: "" });
    await session.idle();
    const list = session.list();
    assert.equal(calls, 1);
    assert.equal(session.syncStatus().failed, 1);
    assert.equal(list.kind, "ready");
    if (list.kind === "ready") {
      assert.equal(list.recipes[0]?.title, "");
    }
  });

  it("refetches on stream events and on reconnect without dropping drafts", async () => {
    const harness = makeHarness();
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.openRecipe("r1");
    session.setDraft("r1", { title: "Hold" });
    harness.setRecipe("r1", {
      title: "From chef",
      ingredients: ["salt"],
      steps: ["mix", "plate"],
      facts: emptyRecipeFacts(),
    });
    harness.setList([{ id: "r1", title: "From chef" }]);
    harness.handlers()?.onEvent({ recipeId: "r1", op: "saved" });
    await session.idle();
    const view = session.recipe("r1");
    assert.equal(view.kind, "ready");
    if (view.kind === "ready") {
      assert.equal(view.recipe.title, "Hold");
      assert.deepEqual(view.recipe.steps, ["mix", "plate"]);
    }
    harness.setList([{ id: "r1", title: "After reconnect" }]);
    harness.handlers()?.onOpen();
    await session.idle();
    const list = session.list();
    assert.equal(list.kind, "ready");
    if (list.kind === "ready") {
      assert.equal(list.recipes[0]?.title, "After reconnect");
    }
    assert.equal(session.syncStatus().connection, "online");
  });

  it("reports connection health separately from save counts", async () => {
    const harness = makeHarness({
      async send() {
        return { ok: false, kind: "unavailable", message: "no route" };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    harness.handlers()?.onOpen();
    await session.saveFields("r1", { title: "Queued" });
    const online = session.syncStatus();
    assert.equal(online.connection, "online");
    assert.equal(online.pending, 1);
    assert.equal(online.failed, 0);
    assert.equal(online.allSaved, false);
    assert.match(online.label, /Online/);
    assert.match(online.label, /1 pending/);
    assert.doesNotMatch(online.label, /All saved/);
    harness.handlers()?.onError();
    const offline = session.syncStatus();
    assert.equal(offline.connection, "offline");
    assert.match(offline.label, /Offline/);
    assert.match(offline.label, /1 pending/);
    session.stop();
  });

  it("does not let a slower open overwrite a newer refetch", async () => {
    const first = deferred<RecipeRow>();
    const second = deferred<RecipeRow>();
    let reads = 0;
    const harness = makeHarness();
    harness.ports.recipes.read = async () => {
      reads += 1;
      const row = reads === 1 ? await first.promise : await second.promise;
      return {
        title: row.title,
        ingredients: [...row.ingredients],
        steps: [...row.steps],
        facts: { ...row.facts, mealTypes: [...row.facts.mealTypes] },
      };
    };
    const session = createKitchenSession(harness.ports);
    await session.start();
    const opening = session.openRecipe("r1");
    await Promise.resolve();
    const refetching = session.refetch();
    await Promise.resolve();
    assert.equal(reads, 2);
    second.resolve({
      title: "Newer",
      ingredients: ["salt"],
      steps: ["mix"],
      facts: emptyRecipeFacts(),
    });
    await refetching;
    const afterRefetch = session.recipe("r1");
    assert.equal(afterRefetch.kind, "ready");
    if (afterRefetch.kind === "ready") {
      assert.equal(afterRefetch.recipe.title, "Newer");
    }
    first.resolve({
      title: "Stale",
      ingredients: ["old"],
      steps: ["old"],
      facts: emptyRecipeFacts(),
    });
    await opening;
    const afterOpen = session.recipe("r1");
    assert.equal(afterOpen.kind, "ready");
    if (afterOpen.kind === "ready") {
      assert.equal(afterOpen.recipe.title, "Newer");
    }
    session.stop();
  });
});
