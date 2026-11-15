import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifies } from "@cookbook/test";

import {
  COOKBOOK_HISTORY,
  leaveRecipe,
  listScrollFromState,
  pushAppPath,
  rememberListPosition,
  type CookbookHistory,
} from "../src/navigate.ts";

type HistoryEntry = { path: string; state: unknown };

function memoryHistory(
  start: string,
): CookbookHistory & { path: string; stack: string[]; entries: HistoryEntry[] } {
  const entries: HistoryEntry[] = [{ path: start, state: null }];
  return {
    get path() {
      return entries[entries.length - 1]?.path ?? start;
    },
    get stack() {
      return entries.map((entry) => entry.path);
    },
    entries,
    get state() {
      return entries[entries.length - 1]?.state ?? null;
    },
    pushState(data, _unused, url) {
      entries.push({ path: String(url ?? ""), state: data });
    },
    replaceState(data, _unused, url) {
      const current = entries[entries.length - 1];
      if (!current) {
        return;
      }
      current.state = data;
      current.path = String(url ?? current.path);
    },
    back() {
      if (entries.length > 1) {
        entries.pop();
      }
    },
  };
}

describe("in-app Back", () => {
  it("pops a recipe opened from the list and replaces a direct recipe open", () => {
    const fromList = memoryHistory("/");
    pushAppPath("/recipes/lentils", fromList, { pathname: "/" });
    assert.deepEqual(fromList.stack, ["/", "/recipes/lentils"]);
    assert.equal(fromList.state, COOKBOOK_HISTORY);
    assert.equal(leaveRecipe(fromList), "pop");
    assert.deepEqual(fromList.stack, ["/"]);

    const deepLink = memoryHistory("/recipes/lentils");
    assert.equal(leaveRecipe(deepLink), "replace");
    assert.deepEqual(deepLink.stack, ["/"]);
  });

  it(
    "restores list query href and scroll from history",
    verifies("233", "f6a81c70d242f531", () => {
    const history = memoryHistory("/");
    const listHref = "/?title=lemon";
    rememberListPosition(history, listHref, 240);
    assert.equal(history.path, listHref);
    assert.equal(listScrollFromState(history.state), 240);
    pushAppPath("/recipes/lentils", history, { pathname: "/" });
    assert.deepEqual(history.stack, [listHref, "/recipes/lentils"]);
    const recipeEntry = history.entries[1];
    assert.equal(recipeEntry?.path, "/recipes/lentils");
    assert.equal(recipeEntry?.state, COOKBOOK_HISTORY);
    assert.notEqual(recipeEntry?.path, listHref);
    assert.equal(leaveRecipe(history), "pop");
    assert.equal(history.path, listHref);
    assert.equal(listScrollFromState(history.state), 240);
    }),
  );
});
