import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { remainingMs, stepStatus, toggleStep } from "../src/prototype/cooking-state.ts";
import {
  createPrototypeCooking,
  memoryWebStorage,
} from "../src/prototype/cooking.ts";
import { CookingScreen } from "../src/prototype/CookingScreen.tsx";
import { PrototypeRuntimeProvider } from "../src/prototype/runtime.tsx";
import { SAMPLE_RECIPES } from "../src/prototype/sample-recipes.ts";

const stewId = "three-hour-sunday-beef-stew";

describe("prototype cooking session", () => {
  it("does not start a session until begin is called", () => {
    const cooking = createPrototypeCooking({ storage: memoryWebStorage() });
    assert.equal(cooking.view(), null);
    assert.equal(cooking.prototypeStore.state(), null);
  });

  it("keeps the session after leave-equivalent reads and restores it from storage", async () => {
    const storage = memoryWebStorage();
    const cooking = createPrototypeCooking({
      storage,
      now: () => 1_000,
      id: () => "session-1",
    });
    await cooking.begin(stewId);
    cooking.prototypeStore.toggleStep(0);
    const first = cooking.prototypeStore.state();
    assert.equal(first?.recipeId, stewId);
    assert.deepEqual(first?.completedSteps, [0]);

    const resumed = createPrototypeCooking({ storage, now: () => 2_000 });
    const restored = resumed.prototypeStore.state();
    assert.equal(restored?.sessionId, "session-1");
    assert.equal(restored?.recipeId, stewId);
    assert.deepEqual(restored?.completedSteps, [0]);
    assert.equal(resumed.view()?.recipeId, stewId);
  });

  it("ends only from the explicit end action", async () => {
    const cooking = createPrototypeCooking({ storage: memoryWebStorage() });
    await cooking.begin(stewId);
    cooking.prototypeStore.toggleStep(0);
    assert.equal(cooking.view()?.status, "active");
    await cooking.end();
    assert.equal(cooking.view(), null);
    assert.equal(cooking.prototypeStore.state(), null);
  });
});

describe("prototype cooking timers", () => {
  it("runs two step timers at once and does not cancel them when a step is completed", () => {
    let n = 0;
    const cooking = createPrototypeCooking({
      storage: memoryWebStorage(),
      now: () => 5_000,
      id: () => `id-${(n += 1)}`,
    });
    cooking.prototypeStore.begin(stewId);
    cooking.prototypeStore.startTimer(2);
    cooking.prototypeStore.startTimer(4);
    let state = cooking.prototypeStore.state();
    assert.equal(state?.timers.length, 2);
    const simmer = state?.timers.find((timer) => timer.stepIndex === 2);
    const dumplings = state?.timers.find((timer) => timer.stepIndex === 4);
    assert.ok(simmer);
    assert.ok(dumplings);
    assert.equal(remainingMs(simmer, 5_000), 150 * 60 * 1000);
    assert.equal(remainingMs(dumplings, 5_000), 25 * 60 * 1000);
    assert.ok(remainingMs(simmer, 10_000) > 0 && remainingMs(dumplings, 10_000) > 0);
    cooking.prototypeStore.toggleStep(2);
    cooking.prototypeStore.toggleStep(0);
    state = cooking.prototypeStore.state();
    assert.equal(state?.timers.length, 2);
    assert.deepEqual(state?.completedSteps, [0, 2]);
    assert.equal(remainingMs(state.timers[0] ?? simmer, 6_000) > 0, true);
    assert.equal(remainingMs(state.timers[1] ?? dumplings, 6_000) > 0, true);
  });

  it("does not treat viewing or opening a timer as progress", () => {
    const cooking = createPrototypeCooking({
      storage: memoryWebStorage(),
      now: () => 0,
      id: () => "timer-open",
    });
    cooking.prototypeStore.begin(stewId);
    cooking.prototypeStore.startTimer(2);
    const before = cooking.prototypeStore.state();
    cooking.prototypeStore.openTimer(before?.timers[0]?.id ?? null);
    const after = cooking.prototypeStore.state();
    assert.deepEqual(after?.completedSteps, []);
    assert.equal(after?.openedTimerId, before?.timers[0]?.id);
    cooking.prototypeStore.openTimer(null);
    assert.equal(cooking.prototypeStore.state()?.openedTimerId, null);
    assert.deepEqual(cooking.prototypeStore.state()?.completedSteps, []);
  });
});

describe("prototype cooking step cards", () => {
  it("keeps completed, current, and upcoming distinct without scrolling changing progress", () => {
    const recipe = SAMPLE_RECIPES.find((item) => item.id === stewId);
    assert.ok(recipe);
    let completed: number[] = [];
    assert.equal(stepStatus(0, completed, recipe.steps.length), "current");
    assert.equal(stepStatus(1, completed, recipe.steps.length), "upcoming");
    completed = toggleStep(
      {
        sessionId: "s",
        recipeId: stewId,
        completedSteps: [],
        checkedIngredientIds: [],
        timers: [],
        openedTimerId: null,
      },
      0,
      recipe.steps.length,
    ).completedSteps;
    assert.equal(stepStatus(0, completed, recipe.steps.length), "completed");
    assert.equal(stepStatus(1, completed, recipe.steps.length), "current");
  });

  it("renders cooking without the four facts", () => {
    const cooking = createPrototypeCooking({
      storage: memoryWebStorage(),
      id: () => "render",
    });
    cooking.prototypeStore.begin("lemon-chicken-bowls");
    const page = renderToString(
      createElement(
        PrototypeRuntimeProvider,
        {
          kitchen: {
            libraryState() {
              return "ok";
            },
            setLibraryState() {},
            fullRecipe() {
              return undefined;
            },
          } as never,
          cooking: cooking.prototypeStore,
        },
        createElement(CookingScreen, { onLeave() {} }),
      ),
    );
    assert.match(page, /Lemon chicken bowls/);
    assert.match(page, /End session/);
    assert.match(page, /Start Roast chicken/);
    assert.match(page, /Start Reduce sauce/);
    assert.doesNotMatch(page, /ui-facts/);
    assert.doesNotMatch(page, /Edit recipe facts/);
  });
});
