import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifies } from "@cookbook/test";

import {
  readThemeChoice,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "../src/theme.ts";


describe("theme", () => {
  it(
    "first paint follows the system",
    verifies("59", "600fa410a0cfb6d9", () => {
      assert.equal(readThemeChoice(null), "system");
      assert.equal(
        readThemeChoice({ getItem: () => null }),
        "system",
      );
      assert.equal(
        readThemeChoice({ getItem: () => "not-a-theme" }),
        "system",
      );
      assert.equal(
        readThemeChoice({
          getItem: () => {
            throw new Error("storage blocked");
          },
        }),
        "system",
      );
      assert.equal(resolveTheme("system", false), "light");
      assert.equal(resolveTheme("system", true), "dark");
      assert.equal(readThemeChoice({ getItem: () => "light" }), "light");
      assert.equal(readThemeChoice({ getItem: () => "dark" }), "dark");
      assert.equal(THEME_STORAGE_KEY, "cookbook-theme");
      const document = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../../../apps/web/index.html"),
        "utf8",
      );
      const moduleAt = document.indexOf('type="module"');
      const bootAt = document.indexOf("cookbook-theme");
      assert.ok(bootAt >= 0 && moduleAt > bootAt);
      assert.match(document, /prefers-color-scheme: dark/);
      assert.match(document, /data-theme/);
    }),
  );
});
