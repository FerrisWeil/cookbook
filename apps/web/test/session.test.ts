import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { memoryLock, memoryStorage, type NetworkPort, type StoragePort } from "../src/sync/ports.ts";
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

function makeHarness(network?: NetworkPort, storage?: StoragePort) {
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
  let ids = 0;
  const reader: RecipeReader = {
    async list() {
      return {
        recipes: list.map((item) => ({ ...item })),
        proteinChoices: [],
      };
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
    storage: storage ?? memoryStorage(),
    lock: memoryLock(),
    network: network ?? {
      async send() {
        return { ok: true, kind: "applied" };
      },
    },
    stream,
    recipes: reader,
    now: () => 0,
    id: () => {
      ids += 1;
      return `mut-${ids}`;
    },
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

  it(
    "shows a facts save before confirm and replays it from storage after reload",
    verifies("194", "6a1db171a1875073", async () => {
      const storage = memoryStorage();
      const gate = deferred<void>();
      const network: NetworkPort = {
        async send() {
          await gate.promise;
          return { ok: true, kind: "applied" };
        },
      };
      const harness = makeHarness(network, storage);
      const session = createKitchenSession(harness.ports);
      await session.start();
      await session.openRecipe("r1");
      await session.saveFields("r1", { primaryProtein: "seitan" });
      const view = session.recipe("r1");
      const list = session.list();
      assert.equal(view.kind, "ready");
      if (view.kind === "ready") {
        assert.equal(view.recipe.facts.primaryProtein, "seitan");
      }
      assert.equal(list.kind, "ready");
      if (list.kind === "ready") {
        assert.equal(list.recipes[0]?.facts.primaryProtein, "seitan");
      }
      assert.equal(session.syncStatus().pending > 0, true);
      const snapshot = await storage.load();
      assert.equal(snapshot[0]?.mutation.fields["primaryProtein"], "seitan");
      gate.resolve();
      await session.idle();
      session.stop();
      const reopened = createKitchenSession(
        makeHarness(
          {
            async send() {
              return { ok: false, kind: "unavailable", message: "offline" };
            },
          },
          memoryStorage(snapshot),
        ).ports,
      );
      await reopened.start();
      await reopened.openRecipe("r1");
      const restored = reopened.recipe("r1");
      assert.equal(restored.kind, "ready");
      if (restored.kind === "ready") {
        assert.equal(restored.recipe.facts.primaryProtein, "seitan");
      }
      assert.equal(reopened.syncStatus().pending > 0, true);
      reopened.stop();
    }),
  );

  it(
    "does not loop a permanent reject and keeps the failed fields visible",
    verifies("196", "1dd370ab8f5727c1", async () => {
    let calls = 0;
    const harness = makeHarness({
      async send() {
        calls += 1;
        return { ok: false, kind: "permanent", message: "Could not save recipe facts." };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.openRecipe("r1");
    await session.saveFields("r1", { primaryProtein: "seitan" });
    await session.idle();
    const view = session.recipe("r1");
    assert.equal(calls, 1);
    assert.equal(session.syncStatus().failed, 1);
    assert.equal(view.kind, "ready");
    if (view.kind === "ready") {
      assert.equal(view.recipe.facts.primaryProtein, "seitan");
    }
    }),
  );

  it(
    "refetches on stream events and on reconnect without dropping drafts",
    verifies("193", "ffe022007107c585", async () => {
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
    }),
  );

  it(
    "reports connection health separately from save counts",
    verifies("195", "352a6b35957bbf8e", async () => {
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
    }),
  );

  it("keeps an unrelated chef field and applies later writes to the same field", async () => {
    const harness = makeHarness({
      async send() {
        return { ok: false, kind: "unavailable", message: "offline" };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.openRecipe("r1");
    await session.saveFields("r1", { primaryProtein: "chicken" });
    await session.saveFields("r1", { primaryProtein: "seitan" });
    await session.idle();
    harness.setRecipe("r1", {
      title: "Chef title",
      ingredients: ["salt"],
      steps: ["mix"],
      facts: emptyRecipeFacts(),
    });
    await session.refetch();
    const view = session.recipe("r1");
    assert.equal(view.kind, "ready");
    if (view.kind === "ready") {
      assert.equal(view.recipe.title, "Chef title");
      assert.equal(view.recipe.facts.primaryProtein, "seitan");
    }
    session.stop();
  });

  it("refetches after a confirmed send so a reconnect snapshot is not stale", async () => {
    const harness = makeHarness({
      async send() {
        harness.setRecipe("r1", {
          title: "Alpha",
          ingredients: ["salt"],
          steps: ["mix"],
          facts: {
            ...emptyRecipeFacts(),
            primaryProtein: "seitan",
          },
        });
        harness.setList([
          {
            id: "r1",
            title: "Alpha",
            facts: { ...emptyRecipeFacts(), primaryProtein: "seitan" },
          },
        ]);
        return { ok: true, kind: "applied" };
      },
    });
    const session = createKitchenSession(harness.ports);
    await session.start();
    await session.openRecipe("r1");
    await session.saveFields("r1", { primaryProtein: "seitan" });
    await session.idle();
    const view = session.recipe("r1");
    assert.equal(view.kind, "ready");
    if (view.kind === "ready") {
      assert.equal(view.recipe.facts.primaryProtein, "seitan");
    }
    assert.equal(session.syncStatus().pending, 0);
    session.stop();
  });

  it("keeps a confirmed overlay until a post-drain refetch succeeds", async () => {
    const harness = makeHarness({
      async send(mutation) {
        const protein =
          typeof mutation.fields["primaryProtein"] === "string"
            ? mutation.fields["primaryProtein"]
            : null;
        harness.setRecipe("r1", {
          title: "Alpha",
          ingredients: ["salt"],
          steps: ["mix"],
          facts: { ...emptyRecipeFacts(), primaryProtein: protein },
        });
        harness.setList([
          {
            id: "r1",
            title: "Alpha",
            facts: { ...emptyRecipeFacts(), primaryProtein: protein },
          },
        ]);
        return { ok: true, kind: "applied" };
      },
    });
    const list = harness.ports.recipes.list;
    const read = harness.ports.recipes.read;
    let down = true;
    harness.ports.recipes.list = async () => {
      if (down) {
        throw new Error("Could not load recipes.");
      }
      return list();
    };
    harness.ports.recipes.read = async (id) => {
      if (down) {
        throw new Error("Could not load this recipe.");
      }
      return read(id);
    };
    const session = createKitchenSession(harness.ports);
    down = false;
    await session.start();
    await session.openRecipe("r1");
    down = true;
    await session.saveFields("r1", { primaryProtein: "seitan" });
    await session.idle();
    const pending = session.recipe("r1");
    assert.equal(pending.kind, "ready");
    if (pending.kind === "ready") {
      assert.equal(pending.recipe.facts.primaryProtein, "seitan");
    }
    assert.equal(session.syncStatus().allSaved, false);
    down = false;
    await session.drain();
    const confirmed = session.recipe("r1");
    assert.equal(confirmed.kind, "ready");
    if (confirmed.kind === "ready") {
      assert.equal(confirmed.recipe.facts.primaryProtein, "seitan");
    }
    assert.equal(session.syncStatus().allSaved, true);
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

  it(
    "ignores a stale list response and refetches the active query from the stream",
    verifies("236", "b453dbde2f61d8f0", async () => {
    const harness = makeHarness();
    const session = createKitchenSession(harness.ports);
    await session.start();
    const original = harness.ports.recipes.list;
    const gate = deferred<void>();
    const queries: unknown[] = [];
    let wave = 0;
    harness.ports.recipes.list = async (query) => {
      const current = (wave += 1);
      queries.push(query ?? null);
      if (current === 1) {
        await gate.promise;
      }
      const payload = await original(query);
      return {
        recipes: payload.recipes.map((item) => ({
          ...item,
          title: current === 1 ? "Stale" : "Current",
        })),
        proteinChoices: payload.proteinChoices,
      };
    };
    const stale = session.setListQuery({ field: "title", phrase: "alpha" });
    const listing = session.list();
    assert.equal(listing.kind, "ready");
    if (listing.kind === "ready") {
      assert.equal(listing.updating, true);
    }
    const fresh = session.setListQuery({ field: "title", phrase: "beta" });
    gate.resolve();
    await stale;
    await fresh;
    const ready = session.list();
    assert.equal(ready.kind, "ready");
    if (ready.kind === "ready") {
      assert.equal(ready.updating, false);
      assert.equal(ready.recipes[0]?.title, "Current");
    }
    harness.handlers()?.onEvent({ recipeId: "r1", op: "saved" });
    await session.idle();
    assert.equal(
      queries.some(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          "phrase" in item &&
          (item as { phrase: string }).phrase === "beta",
      ),
      true,
    );
    session.stop();
    }),
  );
});
