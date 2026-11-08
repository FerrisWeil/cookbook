#!/usr/bin/env node
/**
 * Chrome CDP check against a live stack: IndexedDB outbox through the real
 * facts PATCH. No Playwright. Skipped by smoke when Chrome is missing.
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
const RECIPE_ID = "outbox-browser";

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
          reject(
            new Error(message.error.message ?? JSON.stringify(message.error)),
          );
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
  const browser = new Cdp(ws);
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
  return { chrome, browser, send, sessionId };
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
    const detail = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? JSON.stringify(result.exceptionDetails);
    throw new Error(`${detail} [${expression.slice(0, 180)}]`);
  }
  const raw = result.result?.value;
  if (typeof raw !== "string") {
    throw new Error(`evaluate did not return JSON [${expression.slice(0, 180)}]`);
  }
  return JSON.parse(raw).v;
}

async function waitFor(send, expression, timeoutMs = 12_000, awaitPromise = false) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(send, expression, awaitPromise);
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

const OUTBOX_READ = `new Promise((resolve, reject) => {
  const request = indexedDB.open("cookbook-outbox", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("items")) {
      resolve([]);
      return;
    }
    const tx = db.transaction("items", "readonly");
    const get = tx.objectStore("items").get("queue");
    get.onsuccess = () => resolve(Array.isArray(get.result) ? get.result : []);
    get.onerror = () => reject(get.error);
  };
})`;

function longSteps() {
  return Array.from({ length: 28 }, (_, index) => `Step ${index + 1}. Keep scrolling past the facts form.`);
}

function recipeBody(title, facts) {
  return {
    id: RECIPE_ID,
    title,
    servings: 2,
    actor: "chef",
    ingredients: [{ line: "Chicken · 400 g" }],
    steps: longSteps(),
    facts,
  };
}

const BASE_FACTS = {
  primaryProtein: "chicken",
  totalMinutes: 30,
  effort: "low",
  mealTypes: ["dinner"],
};

const CHEF_FACTS = {
  primaryProtein: "chicken",
  totalMinutes: 99,
  effort: "high",
  mealTypes: ["lunch"],
};

async function seedRecipe(title, facts) {
  const saved = await api("/recipes", {
    method: "PUT",
    body: JSON.stringify(recipeBody(title, facts)),
  });
  if (saved.status !== 200) {
    fail(`seed failed ${saved.status}`);
  }
}

async function readFacts() {
  const read = await api(`/recipes/${RECIPE_ID}?fields=title,facts`);
  return read.body?.recipe ?? {};
}

async function openRecipe(send) {
  await send("Page.navigate", { url: `${WEB}/recipes/${RECIPE_ID}` });
  await waitFor(
    send,
    `document.body ? (String(document.body.innerText || "").includes("Example:") && !String(document.body.innerText || "").includes("Loading recipe")) : false`,
    15_000,
  );
}

async function clickNamed(send, label) {
  await waitFor(
    send,
    `Array.from(document.querySelectorAll("button")).some((b) => b.textContent.includes(${JSON.stringify(label)}))`,
  );
  await evaluate(
    send,
    `(Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes(${JSON.stringify(label)})).click(), true)`,
  );
}

async function setProtein(send, value) {
  await waitFor(send, `Boolean(document.querySelector('input[name="primaryProtein"]'))`);
  await evaluate(
    send,
    `(() => {
      const input = document.querySelector('input[name="primaryProtein"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
}

async function editProtein(send, value) {
  await clickNamed(send, "Edit recipe facts");
  await setProtein(send, value);
  await evaluate(
    send,
    `(document.querySelector('form.facts-form button[type="submit"]').click(), true)`,
  );
}

function hasProtein(items, protein) {
  return (
    Array.isArray(items) &&
    items.some((item) => item?.mutation?.fields?.primaryProtein === protein)
  );
}

function attachFetchGate(browser, send) {
  const gate = { mode: "pass" };
  browser.on("Fetch.requestPaused", (params) => {
    const url = params.request?.url ?? "";
    const method = params.request?.method ?? "";
    const isFactsPatch = method === "PATCH" && url.includes("/facts");
    const handle = async () => {
      if (!isFactsPatch || gate.mode === "pass") {
        await send("Fetch.continueRequest", { requestId: params.requestId });
        return;
      }
      if (gate.mode === "offline") {
        await send("Fetch.failRequest", {
          requestId: params.requestId,
          errorReason: "Failed",
        });
        return;
      }
      const body = Buffer.from(
        JSON.stringify({
          error: "invalid",
          message: "Could not save recipe facts.",
        }),
      ).toString("base64");
      await send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 400,
        responseHeaders: [{ name: "content-type", value: "application/json" }],
        body,
      });
    };
    handle().catch((error) => {
      process.stderr.write(`fetch-gate: ${error instanceof Error ? error.message : String(error)}\n`);
    });
  });
  return gate;
}

async function run() {
  const ready = await fetch(`${WEB}/api/health/ready`)
    .then((r) => r.json())
    .catch(() => null);
  if (ready?.database !== "up") {
    fail("web stack is not ready on :8080");
  }

  const userDataDir = await mkdtemp(join(tmpdir(), "cookbook-chrome-"));
  const port = await freePort();
  const { chrome, browser, send } = await connectChrome(userDataDir, port);
  const gate = attachFetchGate(browser, send);
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*/facts", requestStage: "Request" }],
  });

  try {
    process.stderr.write("phase:seed-scroll\n");
    await seedRecipe("Example: Outbox bowls", BASE_FACTS);
    process.stderr.write("phase:open-scroll\n");
    await openRecipe(send);
    await clickNamed(send, "Edit recipe facts");
    await setProtein(send, "DRAFT HOLD");
    const beforeScroll = await evaluate(
      send,
      `(() => {
        const heading = Array.from(document.querySelectorAll("h2")).find((node) => node.textContent === "Steps");
        if (heading) {
          heading.scrollIntoView();
        } else {
          window.scrollTo(0, Math.min(document.documentElement.scrollHeight / 2, 900));
        }
        return window.scrollY;
      })()`,
    );
    if (!(beforeScroll > 80)) {
      fail(`long recipe did not scroll; scrollY=${beforeScroll}`);
    }
    await seedRecipe("Example: Chef intervening title", CHEF_FACTS);
    await waitFor(
      send,
      `document.body.innerText.includes("Chef intervening title")`,
      10_000,
    );
    const afterLive = await evaluate(
      send,
      `({
        scrollY: window.scrollY,
        draft: document.querySelector('input[name="primaryProtein"]') ? document.querySelector('input[name="primaryProtein"]').value : null,
        status: document.querySelector(".sync-status") ? document.querySelector(".sync-status").textContent : "",
      })`,
    );
    if (afterLive.draft !== "DRAFT HOLD") {
      fail(`live update dropped the unsaved draft: ${JSON.stringify(afterLive)}`);
    }
    if (Math.abs(afterLive.scrollY - beforeScroll) > 80) {
      fail(`live update moved scroll from ${beforeScroll} to ${afterLive.scrollY}`);
    }
    process.stdout.write("browser-outbox-scroll-ok\n");
    await clickNamed(send, "Cancel");

    await seedRecipe("Example: Outbox bowls", BASE_FACTS);
    await openRecipe(send);
    gate.mode = "offline";
    await editProtein(send, "seitan");
    await waitFor(
      send,
      `document.querySelector(".sync-status")?.textContent.includes("pending") || document.querySelector(".sync-status")?.textContent.includes("Offline")`,
      8_000,
    );
    const queued = await waitFor(
      send,
      `(async () => {
        const items = await ${OUTBOX_READ};
        return items.some((item) => item?.mutation?.fields?.primaryProtein === "seitan") ? items : null;
      })()`,
      8_000,
      true,
    );
    if (!hasProtein(queued, "seitan")) {
      fail(`outbox did not persist the offline edit: ${JSON.stringify(queued)}`);
    }
    await seedRecipe("Example: Chef intervening title", CHEF_FACTS);
    await send("Page.reload", { ignoreCache: true });
    await waitFor(
      send,
      `document.body && document.body.innerText.includes("Example:") && !document.body.innerText.includes("Loading recipe")`,
    );
    const afterReload = await evaluate(send, OUTBOX_READ, true);
    if (!hasProtein(afterReload, "seitan")) {
      fail(`reload dropped IndexedDB outbox: ${JSON.stringify(afterReload)}`);
    }
    gate.mode = "pass";
    const deadline = Date.now() + 35_000;
    let facts;
    while (Date.now() < deadline) {
      facts = await readFacts();
      if (
        facts?.facts?.primaryProtein === "seitan" &&
        facts?.facts?.totalMinutes === 99 &&
        facts?.facts?.effort === "high" &&
        Array.isArray(facts?.facts?.mealTypes) &&
        facts.facts.mealTypes.includes("lunch") &&
        facts?.title === "Example: Chef intervening title"
      ) {
        break;
      }
      await sleep(400);
    }
    if (facts?.facts?.primaryProtein !== "seitan") {
      fail(`auto-retry did not save seitan: ${JSON.stringify(facts)}`);
    }
    if (
      facts.facts.totalMinutes !== 99 ||
      facts.facts.effort !== "high" ||
      !facts.facts.mealTypes.includes("lunch") ||
      facts.title !== "Example: Chef intervening title"
    ) {
      fail(`retry overwrote Chef fields: ${JSON.stringify(facts)}`);
    }
    process.stdout.write("browser-outbox-replay-ok\n");

    gate.mode = "reject";
    await seedRecipe("Example: Outbox bowls", BASE_FACTS);
    await openRecipe(send);
    await editProtein(send, "rejected-protein");
    await waitFor(
      send,
      `document.querySelector(".sync-status")?.textContent.includes("need attention")`,
      12_000,
    );
    const rejected = await evaluate(
      send,
      `({
        status: document.querySelector(".sync-status") ? document.querySelector(".sync-status").textContent : "",
        body: document.body ? document.body.innerText : "",
      })`,
    );
    if (!rejected.status.includes("need attention")) {
      fail(`permanent reject did not show failed status: ${rejected.status}`);
    }
    if (!rejected.body.includes("rejected-protein")) {
      fail("permanent reject dropped the submitted protein");
    }
    if (rejected.status.includes("All saved")) {
      fail(`false All saved after permanent reject: ${rejected.status}`);
    }
    const stillQueued = await evaluate(send, OUTBOX_READ, true);
    if (!hasProtein(stillQueued, "rejected-protein")) {
      fail(`permanent reject dropped the outbox item: ${JSON.stringify(stillQueued)}`);
    }
    if (
      stillQueued.some(
        (item) =>
          item?.mutation?.fields?.primaryProtein === "rejected-protein" &&
          item.status !== "failed",
      )
    ) {
      fail(`permanent reject left the item retryable: ${JSON.stringify(stillQueued)}`);
    }
    await sleep(1500);
    const afterHold = await readFacts();
    if (afterHold?.facts?.primaryProtein === "rejected-protein") {
      fail("permanent reject was retried against the API");
    }
    process.stdout.write("browser-outbox-reject-ok\n");
  } finally {
    try {
      browser.ws.close();
    } catch {
      // Chrome may already be gone.
    }
    try {
      chrome.kill("SIGKILL");
    } catch {
      // Already exited.
    }
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
