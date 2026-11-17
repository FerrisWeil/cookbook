import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHORT_TITLE_MAX_LENGTH,
  compileListCriteria,
  displayShortTitle,
  emptyListCriteria,
} from "@cookbook/shared";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { CookingModeView } from "../src/prototype/CookingModeView.tsx";
import {
  createPrototypeCookingClient,
  formatTimerClockValue,
  formatTimerSeconds,
} from "../src/prototype/cookingStore.ts";
import { SevenSegmentClock } from "../src/prototype/SevenSegmentClock.tsx";
import { TimersDrawerProvider } from "../src/prototype/TimersDrawer.tsx";
import {
  createPrototypeController,
  initialPrototypeModeFromSearch,
} from "../src/prototype/prototypeSession.ts";
import { SAMPLE_RECIPES } from "../src/prototype/sampleData.ts";
import { RecipeScreen } from "../src/RecipeScreen.tsx";
import { parseRoute, SETTINGS_PATH } from "../src/route.ts";
import { SettingsScreen } from "../src/SettingsScreen.tsx";
import {
  DEFAULT_COOKING_PREFERENCES,
  initialThemeChoice,
} from "../src/settings/preferences.tsx";

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

describe("TAY-36 prototype sample data & session", () => {
  it("contains 25 edge-case sample recipes with required edge cases", () => {
    assert.equal(SAMPLE_RECIPES.length, 25);
    assert.ok(SAMPLE_RECIPES.some((r) => r.title.length > 90));
    assert.ok(
      SAMPLE_RECIPES.some(
        (r) =>
          r.facts.primaryProtein === null &&
          r.facts.totalMinutes === null &&
          r.facts.effort === null &&
          r.facts.mealTypes.length === 0,
      ),
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (r) => r.facts.totalMinutes === null && r.facts.effort !== null,
      ),
    );
    assert.ok(SAMPLE_RECIPES.some((r) => r.facts.primaryProtein === "duck"));
    assert.ok(
      SAMPLE_RECIPES.some(
        (r) =>
          r.facts.mealTypes.includes("lunch") &&
          r.facts.mealTypes.includes("dinner"),
      ),
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (r) => r.facts.totalMinutes === 180 && r.facts.effort === "low",
      ),
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (r) =>
          r.facts.totalMinutes !== null &&
          r.facts.totalMinutes <= 25 &&
          r.facts.effort === "high",
      ),
    );
    assert.ok(SAMPLE_RECIPES.some((r) => r.ingredients.length >= 20));
    assert.ok(SAMPLE_RECIPES.some((r) => r.facts.primaryProtein === "fish"));
    assert.ok(SAMPLE_RECIPES.some((r) => r.facts.primaryProtein === "shellfish"));
    assert.ok(
      SAMPLE_RECIPES.some((r) =>
        r.steps.some((s) => (s.timers?.length ?? 0) >= 2),
      ),
    );
  });

  it("filters sample recipes accurately including fish vs shellfish and unknown time exclusion", async () => {
    const controller = createPrototypeController();
    await controller.session.start();

    await controller.session.setListQuery(
      compileListCriteria({
        ...emptyListCriteria(),
        proteins: ["fish"],
      }),
    );
    const fishView = controller.session.list();
    assert.equal(fishView.kind, "ready");
    if (fishView.kind === "ready") {
      assert.ok(fishView.recipes.length >= 2);
      assert.ok(
        fishView.recipes.every((r) => r.facts.primaryProtein === "fish"),
      );
    }

    await controller.session.setListQuery(
      compileListCriteria({
        ...emptyListCriteria(),
        maxTotalMinutes: 30,
      }),
    );
    const quickView = controller.session.list();
    assert.equal(quickView.kind, "ready");
    if (quickView.kind === "ready") {
      assert.ok(
        quickView.recipes.every(
          (r) => r.facts.totalMinutes !== null && r.facts.totalMinutes <= 30,
        ),
      );
    }
  });

  it("supports simulated empty, loading, error states and recovery on Try again", async () => {
    assert.equal(initialPrototypeModeFromSearch("?state=empty"), "empty");
    assert.equal(initialPrototypeModeFromSearch("?protoState=loading"), "loading");
    assert.equal(initialPrototypeModeFromSearch("?state=error"), "error");
    assert.equal(initialPrototypeModeFromSearch(""), "normal");

    const controller = createPrototypeController();
    await controller.session.start();

    controller.setMode("empty");
    const empty = controller.session.list();
    assert.equal(empty.kind, "ready");
    if (empty.kind === "ready") {
      assert.equal(empty.recipes.length, 0);
    }

    controller.setMode("loading");
    assert.equal(controller.session.list().kind, "loading");

    controller.setMode("error");
    assert.equal(controller.session.list().kind, "error");

    await controller.session.refetch();
    assert.equal(controller.getMode(), "normal");
    const recovered = controller.session.list();
    assert.equal(recovered.kind, "ready");
    if (recovered.kind === "ready") {
      assert.equal(recovered.recipes.length, 25);
    }
  });

  it("holds facts edits in memory and resets cleanly", async () => {
    const controller = createPrototypeController();
    await controller.session.start();
    await controller.session.saveFields("mystery-pantry-noodle-soup", {
      primaryProtein: "tofu/tempeh",
      totalMinutes: 15,
    });
    await controller.session.idle();
    await controller.session.openRecipe("mystery-pantry-noodle-soup");
    const edited = controller.session.recipe("mystery-pantry-noodle-soup");
    assert.equal(edited.kind, "ready");
    if (edited.kind === "ready") {
      assert.equal(edited.recipe.facts.primaryProtein, "tofu/tempeh");
      assert.equal(edited.recipe.facts.totalMinutes, 15);
    }
    await controller.resetFacts();
    await controller.session.openRecipe("mystery-pantry-noodle-soup");
    const reset = controller.session.recipe("mystery-pantry-noodle-soup");
    assert.equal(reset.kind, "ready");
    if (reset.kind === "ready") {
      assert.equal(reset.recipe.facts.primaryProtein, null);
      assert.equal(reset.recipe.facts.totalMinutes, null);
    }
  });
});

describe("TAY-36 cooking mode client & UI", () => {
  it("runs multiple timers across step navigation and step completion without cancelling", async () => {
    let clock = 10_000;
    const client = createPrototypeCookingClient({
      findRecipe: (id) => SAMPLE_RECIPES.find((r) => r.id === id),
      now: () => clock,
      persist: false,
    });
    await client.begin("duck-breast-cherry-reduction");
    const extras = client.getExtras();
    assert.ok(extras);

    const step0Timer = extras.steps[0]?.timers?.[0];
    const step1Timer = extras.steps[1]?.timers?.[0];
    assert.ok(step0Timer && step1Timer);

    client.startTimer(0, step0Timer);
    client.startTimer(1, step1Timer);
    assert.equal(client.runningTimerCount(), 2);

    await client.show(1);
    assert.deepEqual(client.view()?.completedSteps, []);

    client.toggleStepCompleted(0);
    assert.deepEqual(client.view()?.completedSteps, [0]);
    assert.equal(client.runningTimerCount(), 2);

    clock += 5_000;
    client.pauseTimer(client.getExtras()!.timers[0]!.id);
    const afterPause = client.getExtras()!.timers[0]!;
    assert.equal(afterPause.status, "paused");
    assert.equal(afterPause.remainingSeconds, step0Timer.durationSeconds - 5);

    client.openTimerFullscreen(afterPause.id);
    assert.equal(client.getExtras()!.fullscreenTimerId, afterPause.id);
    client.closeTimerFullscreen();
    assert.equal(client.getExtras()!.fullscreenTimerId, null);

    client.toggleIngredient(0);
    client.toggleStepIngredient(0, 0);
    assert.deepEqual(client.getExtras()!.checkedIngredients, [0]);
    assert.deepEqual(client.getExtras()!.checkedStepIngredients, ["0:0"]);

    await client.end();
    assert.equal(client.view(), null);
    assert.equal(client.getExtras(), null);
  });

  it("formats timer seconds cleanly and hides the four facts during cooking mode", async () => {
    assert.equal(formatTimerSeconds(45), "00:45");
    assert.equal(formatTimerSeconds(3665), "1:01:05");

    const client = createPrototypeCookingClient({
      findRecipe: (id) => SAMPLE_RECIPES.find((r) => r.id === id),
      now: () => 1_000,
      persist: false,
    });
    await client.begin("jammy-eggs-ricotta-toast");
    const timerDef = client.getExtras()!.steps[0]!.timers![0]!;
    client.startTimer(0, timerDef);

    const page = html(
      createElement(RecipeScreen, {
        state: {
          kind: "ready",
          recipe: {
            title: "6-Minute Jammy Eggs with Whipped Ricotta Toast",
            ingredients: ["4 large eggs"],
            steps: ["Boil."],
            facts: {
              primaryProtein: "eggs",
              totalMinutes: 12,
              effort: "low",
              mealTypes: ["breakfast"],
            },
          },
        },
        editing: false,
        draft: null,
        formStatus: { kind: "idle" },
        onBack() {},
        onRetry() {},
        onEditFacts() {},
        onDraftChange() {},
        onSaveFacts() {},
        onCancelFacts() {},
        cooking: {
          mode: "here",
          session: client.view()!,
          error: null,
          onShow() {},
          onComplete() {},
          onUndo() {},
          onFinish() {},
          prototype: {
            client,
            extras: client.getExtras()!,
          },
        },
      }),
    );

    assert.doesNotMatch(page, /ui-facts/);
    assert.doesNotMatch(page, /Edit recipe facts/);
    assert.match(page, /Active step/);
    assert.match(page, /Upcoming/);
    assert.match(page, /role="checkbox"/);
    assert.match(page, /For this step/);
    assert.match(page, /Timers \(1\)/);
    assert.match(page, /End cooking session/);

    const pureCooking = html(
      createElement(CookingModeView, {
        client,
        extras: client.getExtras()!,
        displayedStep: 0,
        completedSteps: [],
        error: null,
        onBack() {},
        onShow() {},
        onFinish() {},
      }),
    );
    assert.match(pureCooking, /Jammy eggs/);
    assert.match(pureCooking, /cooking-sticky-dock/);
    assert.match(pureCooking, /cooking-control-bar/);

    const collapsedView = html(
      createElement(CookingModeView, {
        client,
        extras: client.getExtras()!,
        displayedStep: 1,
        completedSteps: [0],
        error: null,
        onBack() {},
        onShow() {},
        onFinish() {},
      }),
    );
    assert.match(collapsedView, /cooking-step-card--collapsed/);
    assert.match(collapsedView, /Expand step 1/);
    assert.match(collapsedView, /Undo step 1 completion/);
    assert.match(collapsedView, /Step 1/);
    assert.match(collapsedView, /Step 2 of /);

    const focusedCompletedView = html(
      createElement(CookingModeView, {
        client,
        extras: client.getExtras()!,
        displayedStep: 0,
        completedSteps: [0],
        error: null,
        onBack() {},
        onShow() {},
        onFinish() {},
      }),
    );
    assert.doesNotMatch(focusedCompletedView, /cooking-step-card--collapsed/);
    assert.match(focusedCompletedView, /Undo step/);
    client.close();
  });

  it("defaults theme to dark, chime checkpoints to 1m + 0s, Ready-at off, and renders /settings", () => {
    assert.equal(initialThemeChoice(), "dark");
    assert.equal(DEFAULT_COOKING_PREFERENCES.showReadyAtTime, false);
    assert.equal(DEFAULT_COOKING_PREFERENCES.autoOpenTimersOnFinish, true);
    assert.deepEqual(DEFAULT_COOKING_PREFERENCES.timerChimeCheckpoints, [60, 0]);
    assert.deepEqual(parseRoute(SETTINGS_PATH), { name: "settings" });
    const page = html(createElement(SettingsScreen, { onBack() {} }));
    assert.match(page, /<h1>Settings<\/h1>/);
    assert.match(page, /Dark \(Default\)/);
    assert.match(page, /Auto-collapse completed steps/);
    assert.match(page, /Auto-advance to next step/);
    assert.match(page, /Timer audio chimes/);
    assert.match(page, /1 min before/);
    assert.match(page, /Complete \(00:00\)/);
    assert.match(page, /Test chime/);
  });

  it("supports global ad-hoc timers, negative nudges, overtime count-up, and 7-segment display", async () => {
    let clock = 1_000;
    const client = createPrototypeCookingClient({
      findRecipe: (id) => SAMPLE_RECIPES.find((r) => r.id === id),
      now: () => clock,
      persist: false,
    });
    client.startAdhocTimer(120, "Toast garlic");
    assert.equal(client.runningTimerCount(), 1);
    const created = client.getTimers()[0]!;
    assert.equal(created.stepIndex, null);
    assert.equal(created.label, "Toast garlic");
    assert.equal(formatTimerClockValue(created), "02:00");

    client.addTimerSeconds(created.id, -60);
    assert.equal(client.getTimers()[0]!.remainingSeconds, 60);

    clock += 74_000;
    await client.open();
    const finished = client.getTimers()[0]!;
    assert.equal(finished.status, "finished");
    assert.equal(finished.remainingSeconds, 0);
    assert.equal(finished.overtimeSeconds, 14);
    assert.equal(formatTimerClockValue(finished), "+00:14");

    client.restartTimer(finished.id);
    assert.equal(client.getTimers()[0]!.status, "running");
    assert.equal(client.getTimers()[0]!.remainingSeconds, 120);

    const seg = html(
      createElement(SevenSegmentClock, {
        value: "+00:14",
        tone: "finished",
        size: "sm",
        ariaLabel: "Overtime 14 seconds",
      }),
    );
    assert.match(seg, /seg-clock--finished/);
    assert.match(seg, /seg-plus/);
    assert.match(seg, /seg-digit/);

    const drawerHtml = html(
      createElement(
        TimersDrawerProvider,
        { client },
        createElement("div", null, "App body"),
      ),
    );
    assert.match(drawerHtml, /timers-edge-handle/);
    assert.match(drawerHtml, /seg-clock/);
    client.close();
  });

  it("enforces shortTitle length limit across all 25 sample recipes and syncs multi-timer ticks to whole seconds", async () => {
    for (const recipe of SAMPLE_RECIPES) {
      assert.ok(
        recipe.shortTitle.trim().length > 0 &&
          recipe.shortTitle.length <= SHORT_TITLE_MAX_LENGTH,
        `${recipe.id}: "${recipe.shortTitle}" (${recipe.shortTitle.length})`,
      );
      assert.equal(displayShortTitle(recipe), recipe.shortTitle);
    }
    assert.equal(
      displayShortTitle({ title: "Fallback full title", shortTitle: null }),
      "Fallback full title",
    );

    // Timer A starts at .200ms, Timer B starts at .800ms -> both anchor endAtMs to :000ms
    let clock = 10_200;
    const syncedClient = createPrototypeCookingClient({
      findRecipe: (id) => SAMPLE_RECIPES.find((r) => r.id === id),
      now: () => clock,
      persist: false,
    });
    syncedClient.startAdhocTimer(60, "Timer A");
    clock = 12_800;
    syncedClient.startAdhocTimer(60, "Timer B");
    const [a, b] = syncedClient.getTimers();
    assert.equal((a!.endAtMs ?? 1) % 1000, 0);
    assert.equal((b!.endAtMs ?? 1) % 1000, 0);
    syncedClient.close();
  });
});
