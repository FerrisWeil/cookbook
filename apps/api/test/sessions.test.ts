import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MESSAGES, type CookingSnapshot } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { SessionError } from "../src/sessions/error.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";
import type { SessionStore } from "../src/sessions/types.ts";

function snapshot(steps = ["Chop.", "Simmer."]): CookingSnapshot {
  return {
    title: "Example: Soup",
    servings: 2,
    ingredients: ["1 onion"],
    steps,
  };
}

function start(
  store: SessionStore,
  mutationId: string,
  recipeId = "soup",
  snap = snapshot(),
) {
  return store.start({
    mutationId,
    recipeId,
    loadSnapshot: async () => snap,
  });
}

describe("cooking session rules", () => {
  it(
    "keeps a single active session and does not revive a finished one",
    verifies("199", "312a4c7f175eef3c", async () => {
      const store = createMemorySessionStore();
      const first = await start(store, "start-1");
      const retry = await start(store, "start-1");
      assert.equal(retry.id, first.id);
      assert.equal(retry.status, "active");
      await assert.rejects(start(store, "start-2"), (error: unknown) => {
        assert.ok(error instanceof SessionError);
        assert.equal(error.code, "active");
        assert.equal(error.session?.id, first.id);
        return true;
      });
      assert.equal((await store.resume())?.id, first.id);
      await store.finish({ mutationId: "finish-1", sessionId: first.id });
      await assert.rejects(start(store, "start-1"), (error: unknown) => {
        assert.ok(error instanceof SessionError);
        assert.equal(error.code, "ended");
        return true;
      });
      assert.equal(await store.resume(), null);
    }),
  );

  it(
    "keeps the displayed step and completed steps independent",
    verifies("201", "f03ec42b9d54300e", async () => {
      const store = createMemorySessionStore();
      const session = await start(store, "start-1");
      const shown = await store.display({
        mutationId: "show-1",
        sessionId: session.id,
        step: 1,
      });
      assert.equal(shown.displayedStep, 1);
      assert.deepEqual(shown.completedSteps, []);
      const completed = await store.complete({
        mutationId: "done-0",
        sessionId: session.id,
        step: 0,
      });
      assert.equal(completed.displayedStep, 1);
      assert.deepEqual(completed.completedSteps, [0]);
      const undone = await store.undo({
        mutationId: "undo-0",
        sessionId: session.id,
        step: 0,
      });
      assert.equal(undone.displayedStep, 1);
      assert.deepEqual(undone.completedSteps, []);
    }),
  );

  it(
    "does not toggle a step when complete or undo is repeated",
    verifies("202", "d8e2a559733feaa4", async () => {
      const store = createMemorySessionStore();
      const session = await start(store, "start-1");
      await store.complete({ mutationId: "done-a", sessionId: session.id, step: 0 });
      const again = await store.complete({
        mutationId: "done-b",
        sessionId: session.id,
        step: 0,
      });
      const same = await store.complete({
        mutationId: "done-a",
        sessionId: session.id,
        step: 0,
      });
      assert.deepEqual(again.completedSteps, [0]);
      assert.deepEqual(same.completedSteps, [0]);
      await store.undo({ mutationId: "undo-a", sessionId: session.id, step: 0 });
      const undoneAgain = await store.undo({
        mutationId: "undo-b",
        sessionId: session.id,
        step: 0,
      });
      const sameUndo = await store.undo({
        mutationId: "undo-a",
        sessionId: session.id,
        step: 0,
      });
      assert.deepEqual(undoneAgain.completedSteps, []);
      assert.deepEqual(sameUndo.completedSteps, []);
      assert.equal(sameUndo.displayedStep, 0);
    }),
  );

  it(
    "resumes the active session and stays finished when finish is repeated",
    verifies("203", "1389385fd296ebfd", async () => {
      const store = createMemorySessionStore();
      assert.equal(await store.resume(), null);
      const session = await start(store, "start-1");
      assert.equal((await store.resume())?.id, session.id);
      const finished = await store.finish({
        mutationId: "finish-1",
        sessionId: session.id,
      });
      assert.equal(finished.status, "finished");
      const repeated = await store.finish({
        mutationId: "finish-1",
        sessionId: session.id,
      });
      assert.equal(repeated.status, "finished");
      assert.equal(await store.resume(), null);
      await assert.rejects(
        store.finish({ mutationId: "finish-2", sessionId: session.id }),
        (error: unknown) => {
          assert.ok(error instanceof SessionError);
          assert.equal(error.message, MESSAGES.sessionEnded);
          return true;
        },
      );
      assert.equal(await store.resume(), null);
    }),
  );
});
