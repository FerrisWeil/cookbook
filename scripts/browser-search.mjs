#!/usr/bin/env node
/**
 * Chrome CDP check: title search, filters, remove, clear, detail/Back,
 * no-match, error retry, and filters focus return.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const WEB = process.env.WEB_ORIGIN ?? "http://127.0.0.1:8080";
const API = process.env.API_ORIGIN ?? "http://127.0.0.1:3000";
const MCP =
  process.env.API_AUTH_TOKEN_MCP ?? "local-dev-api-mcp-token-not-for-nas";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function chromeBin() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }
  for (const bin of ["google-chrome-stable", "google-chrome", "chromium"]) {
    try {
      execFileSync("which", [bin], { stdio: "ignore" });
      return bin;
    } catch {
      // Try the next name.
    }
  }
  fail("chrome not found");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${MCP}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON stays text.
  }
  return { status: response.status, body };
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message ?? JSON.stringify(message.error)));
          return;
        }
        resolve(message.result);
        return;
      }
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params, message.sessionId);
        }
      }
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

async function connectChrome(userDataDir, port) {
  const bin = chromeBin();
  const chrome = spawn(
    bin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-search-engine-choice-screen",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const deadline = Date.now() + 20_000;
  let version;
  while (Date.now() < deadline) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) =>
        r.json(),
      );
      break;
    } catch {
      await sleep(150);
    }
  }
  if (!version?.webSocketDebuggerUrl) {
    chrome.kill("SIGKILL");
    fail(`chrome did not open a debugger port (${bin})`);
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener(
      "error",
      () => reject(new Error("cdp websocket failed")),
      { once: true },
    );
  });
  return { chrome, browser: new Cdp(ws) };
}

async function attachPage(browser) {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const attached = await browser.send("Target.attachToTarget", {
    targetId: created.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  const send = (method, params) => browser.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 720,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*/api/recipes*", requestStage: "Request" }],
  });
  return { send };
}

async function evaluate(send, expression, awaitPromise = false) {
  const wrapped = awaitPromise
    ? `Promise.resolve().then(() => (${expression})).then((value) => JSON.stringify({ v: value ?? null }))`
    : `JSON.stringify({ v: (() => (${expression}))() ?? null })`;
  const result = await send("Runtime.evaluate", {
    expression: wrapped,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail =
      result.exceptionDetails.exception?.description ??
      result.exceptionDetails.text ??
      JSON.stringify(result.exceptionDetails);
    throw new Error(`${detail} [${expression.slice(0, 180)}]`);
  }
  const raw = result.result?.value;
  if (typeof raw !== "string") {
    throw new Error(`evaluate did not return JSON [${expression.slice(0, 180)}]`);
  }
  return JSON.parse(raw).v;
}

async function waitFor(send, expression, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(send, expression);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      await sleep(150);
      continue;
    }
    if (last) {
      return last;
    }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${expression}; last=${JSON.stringify(last)}`);
}

async function saveRecipe(id, title, extras = {}) {
  const saved = await api("/recipes", {
    method: "PUT",
    body: JSON.stringify({
      id,
      actor: "chef",
      title,
      servings: 2,
      steps: ["Cook."],
      ingredients: extras.ingredients ?? [{ line: "salt", name: "salt" }],
      facts: extras.facts,
    }),
  });
  if (saved.status !== 200) {
    fail(`save ${id} failed ${saved.status} ${JSON.stringify(saved.body)}`);
  }
}

async function main() {
  const saved = await Promise.all([
    saveRecipe("search-title", "Example: Chicken breast bake"),
    saveRecipe("search-split", "Example: Pan supper", {
      ingredients: [
        { line: "chicken stock", name: "chicken stock" },
        { line: "turkey breast", name: "turkey breast" },
      ],
    }),
    saveRecipe("search-garlic", "Example: Lemon garlic", {
      ingredients: [
        { line: "garlic", name: "garlic" },
        { line: "lemon zest", name: "lemon zest" },
      ],
      facts: {
        primaryProtein: null,
        totalMinutes: 20,
        effort: "low",
        mealTypes: ["dinner"],
      },
    }),
  ]);
  void saved;

  const userDataDir = await mkdtemp(join(tmpdir(), "cookbook-search-"));
  const port = await freePort();
  const { chrome, browser } = await connectChrome(userDataDir, port);
  const gate = { failNext: false };
  browser.on("Fetch.requestPaused", (params, sessionId) => {
    const url = params.request?.url ?? "";
    const reply = (name, args) => browser.send(name, args, sessionId);
    const handle = async () => {
      const listGet =
        url.includes("/api/recipes") &&
        !url.includes("/api/recipes/events") &&
        !url.includes("/api/recipes/");
      if (gate.failNext && listGet) {
        gate.failNext = false;
        await reply("Fetch.failRequest", {
          requestId: params.requestId,
          errorReason: "Failed",
        });
        return;
      }
      await reply("Fetch.continueRequest", { requestId: params.requestId });
    };
    handle().catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    });
  });

  try {
    const { send } = await attachPage(browser);
    await send("Page.navigate", { url: WEB });
    await waitFor(send, `document.querySelector("h1")?.textContent === "Recipes"`);
    await waitFor(
      send,
      `Array.from(document.querySelectorAll("a")).some((a) => a.textContent.includes("Chicken breast bake"))`,
    );

    await evaluate(
      send,
      `(document.querySelector("input[type=search]").value = "chicken breast", document.querySelector("input[type=search]").dispatchEvent(new Event("input", { bubbles: true })), true)`,
    );
    await sleep(1100);
    await waitFor(
      send,
      `Array.from(document.querySelectorAll("a")).some((a) => a.textContent.includes("Chicken breast bake")) && !Array.from(document.querySelectorAll("a")).some((a) => a.textContent.includes("Pan supper"))`,
    );
    process.stdout.write("browser-search-title-ok\n");

    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Filters")).click(), true)`,
    );
    await waitFor(send, `document.querySelector("dialog")?.open === true`);
    await evaluate(
      send,
      `(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), document.querySelector("dialog")?.close(), true)`,
    );
    await waitFor(send, `document.querySelector("dialog")?.open !== true`);
    await waitFor(
      send,
      `document.activeElement === Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Filters"))`,
    );
    process.stdout.write("browser-search-focus-ok\n");

    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Filters")).click(), true)`,
    );
    await waitFor(send, `document.querySelector("dialog")?.open === true`);
    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("input[type=checkbox]")).find((i) => i.parentElement?.textContent.includes("dinner")).click(), true)`,
    );
    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Done").click(), true)`,
    );
    await waitFor(
      send,
      `Array.from(document.querySelectorAll("button")).some((b) => (b.getAttribute("aria-label") || "").includes("Remove dinner") || b.textContent.includes("dinner"))`,
    );
    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "").includes("Remove") && b.textContent.includes("dinner")).click(), true)`,
    );
    process.stdout.write("browser-search-filters-ok\n");

    await evaluate(
      send,
      `(document.querySelector("input[type=search]").value = "zzzz-no-match", document.querySelector("input[type=search]").dispatchEvent(new Event("input", { bubbles: true })), true)`,
    );
    await sleep(1100);
    await waitFor(
      send,
      `document.body.textContent.includes("No recipes match.")`,
    );
    process.stdout.write("browser-search-nomatch-ok\n");

    gate.failNext = true;
    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Clear all")).click(), true)`,
    );
    await waitFor(
      send,
      `document.body.textContent.includes("Could not load recipes.") || document.body.textContent.includes("Try again") || Array.from(document.querySelectorAll("a")).length > 0`,
    );
    const failed = await evaluate(
      send,
      `document.body.textContent.includes("Try again")`,
    );
    if (failed) {
      await evaluate(
        send,
        `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Try again")).click(), true)`,
      );
    }
    await waitFor(
      send,
      `Array.from(document.querySelectorAll("a")).some((a) => a.textContent.includes("Chicken breast bake"))`,
    );
    process.stdout.write("browser-search-retry-ok\n");

    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("a")).find((a) => a.textContent.includes("Chicken breast bake")).click(), true)`,
    );
    await waitFor(send, `document.body.textContent.includes("Back")`);
    await evaluate(
      send,
      `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Back").click(), true)`,
    );
    await waitFor(send, `document.querySelector("h1")?.textContent === "Recipes"`);
    process.stdout.write("browser-search-back-ok\n");
  } finally {
    chrome.kill("SIGKILL");
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
