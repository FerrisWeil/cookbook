import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { covers } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { App, StatusCard } from "../src/App.tsx";

describe("home page", () => {
  it("loads and shows whether the API and database are ready", () => {
    covers("6.2.1", "6.2.2");

    function html(node: ReturnType<typeof createElement>): string {
      return renderToString(node).replaceAll("<!-- -->", "");
    }

    const page = html(createElement(App));
    assert.match(page, /<h1>Cookbook<\/h1>/);
    assert.match(page, /Checking the stack/);

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
  });
});
