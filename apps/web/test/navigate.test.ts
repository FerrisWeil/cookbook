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

function memoryHistory(start: string): CookbookHistory & { path: string; stack: string[] } {
  const stack = [start];
  let state: unknown = null;
  return {
    get path() {
      return stack[stack.length - 1] ?? start;
    },
    stack,
    get state() {
      return state;
    },
    pushState(data, _unused, url) {
      state = data;
      stack.push(String(url ?? ""));
    },
    replaceState(data, _unused, url) {
      state = data;
      stack[stack.length - 1] = String(url ?? "");
    },
    back() {
      if (stack.length > 1) {
        stack.pop();
        state = null;
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
    rememberListPosition(history, "/?title=lemon", 240);
    assert.equal(history.path, "/?title=lemon");
    assert.equal(listScrollFromState(history.state), 240);
    pushAppPath("/recipes/lentils", history, { pathname: "/" });
    assert.equal(leaveRecipe(history), "pop");
    assert.equal(history.path, "/?title=lemon");
    }),
  );
});
