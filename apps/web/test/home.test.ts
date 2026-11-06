import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifies } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { App, StatusCard } from "../src/App.tsx";

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

describe("home page", () => {
  it(
    "loads",
    verifies("137", "2b00b1e0d162577e", () => {
      const page = html(createElement(App));
      assert.match(page, /<h1>Cookbook<\/h1>/);
      assert.match(page, /Checking the stack/);
    }),
  );

  it(
    "shows whether the API and database are ready",
    verifies("138", "9c07925429d86635", () => {
      const up = html(
        createElement(StatusCard, {
          state: {
            kind: "ready",
            status: { status: "ok", database: "up", seed: true },
          },
        }),
      );
      assert.match(up, /Stack is up/);
      assert.match(up, /Database is ready/);

      const down = html(
        createElement(StatusCard, {
          state: {
            kind: "ready",
            status: { status: "degraded", database: "down", seed: false },
          },
        }),
      );
      assert.match(down, /API reached, database down, seed missing/);

      const error = html(
        createElement(StatusCard, {
          state: { kind: "error", message: "fetch failed" },
        }),
      );
      assert.match(error, /Cannot reach the API \(fetch failed\)/);
    }),
  );
});
