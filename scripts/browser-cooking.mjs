#!/usr/bin/env node
/**
 * Chrome CDP check: two pages share one live cooking session, and an offline
 * reload keeps the confirmed snapshot and replays the queued step.
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
const RECIPE_ID = "cooking-browser";

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
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
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
    ws.addEventListener("error", () => reject(new Error("cdp websocket failed")), { once: true });
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
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*sessions*", requestStage: "Request" }],
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

function attachSessionGate(browser) {
  const gate = { mode: "pass" };
  browser.on("Fetch.requestPaused", (params, sessionId) => {
    const url = params.request?.url ?? "";
    const reply = (name, args) => browser.send(name, args, sessionId);
    const handle = async () => {
      if (!url.includes("/sessions") || gate.mode === "pass") {
        await reply("Fetch.continueRequest", { requestId: params.requestId });
        return;
      }
      await reply("Fetch.failRequest", {
        requestId: params.requestId,
        errorReason: "Failed",
      });
    };
    handle().catch((error) => {
      process.stderr.write(
        `session-gate: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
  });
  return gate;
}

const QUEUE_READ = `new Promise((resolve, reject) => {
  const request = indexedDB.open("cookbook-outbox", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction("items", "readonly");
    const get = tx.objectStore("items").get("cooking-queue");
    get.onsuccess = () => resolve(Array.isArray(get.result) ? get.result : []);
    get.onerror = () => reject(get.error);
  };
})`;

async function activeSession() {
  const read = await api("/sessions/active");
  return read.status === 200 ? read.body?.session : null;
}

async function run() {
  const ready = await fetch(`${WEB}/api/health/ready`)
    .then((response) => response.json())
    .catch(() => null);
  if (ready?.database !== "up") {
    fail("web stack is not ready on :8080");
  }
  const saved = await api("/recipes", {
    method: "PUT",
    body: JSON.stringify({
      id: RECIPE_ID,
      title: "Example: Session bowls",
      servings: 2,
      actor: "chef",
      ingredients: [{ line: "1 onion" }],
      steps: ["Chop.", "Simmer."],
    }),
  });
  if (saved.status !== 200) {
    fail(`seed failed ${saved.status}`);
  }

  const userDataDir = await mkdtemp(join(tmpdir(), "cookbook-chrome-cooking-"));
  const port = await freePort();
  const { chrome, browser } = await connectChrome(userDataDir, port);
  const gate = attachSessionGate(browser);
  const first = await attachPage(browser);
  const second = await attachPage(browser);
  try {
    await first.send("Page.navigate", { url: `${WEB}/recipes/${RECIPE_ID}` });
    await waitFor(
      first.send,
      `document.body && document.body.innerText.includes("Example: Session bowls") && document.body.innerText.includes("Start cooking")`,
    );
    await clickNamed(first.send, "Start cooking");
    await waitFor(first.send, `document.body.innerText.includes("Finish cooking")`);
    await second.send("Page.navigate", { url: `${WEB}/recipes/${RECIPE_ID}` });
    await waitFor(second.send, `document.body.innerText.includes("Finish cooking")`, 12_000);
    await clickNamed(first.send, "Mark this step done");
    await waitFor(second.send, `document.body.innerText.includes("Undo this step")`, 12_000);
    const live = await activeSession();
    if (live?.snapshot?.title !== "Example: Session bowls" || !live.completedSteps?.includes(0)) {
      fail(`live session did not share completion: ${JSON.stringify(live)}`);
    }
    if (live.displayedStep !== 0) {
      fail(`completion changed the displayed step: ${JSON.stringify(live)}`);
    }
    process.stdout.write("browser-cooking-live-ok\n");

    gate.mode = "offline";
    await clickNamed(first.send, "Next step");
    await waitFor(first.send, `document.querySelector(".step-current")?.textContent.includes("Simmer.")`);
    const queued = await waitFor(
      first.send,
      `(async () => {
        const items = await ${QUEUE_READ};
        return items.some((item) => item?.mutation?.fields?.displayedStep === 1) ? items : null;
      })()`,
      8_000,
      true,
    );
    if (!Array.isArray(queued) || !queued.some((item) => item?.mutation?.fields?.displayedStep === 1)) {
      fail(`offline step was not stored: ${JSON.stringify(queued)}`);
    }
    await first.send("Page.reload", { ignoreCache: true });
    await waitFor(
      first.send,
      `document.body && document.body.innerText.includes("Example: Session bowls") && document.body.innerText.includes("Finish cooking") && document.querySelector(".step-current")?.textContent.includes("Simmer.")`,
      12_000,
    );
    const afterReload = await evaluate(first.send, QUEUE_READ, true);
    if (!afterReload.some((item) => item?.mutation?.fields?.displayedStep === 1)) {
      fail(`reload dropped the cooking queue: ${JSON.stringify(afterReload)}`);
    }
    gate.mode = "pass";
    const deadline = Date.now() + 20_000;
    let replayed = null;
    while (Date.now() < deadline) {
      replayed = await activeSession();
      if (replayed?.displayedStep === 1 && replayed.completedSteps?.includes(0)) {
        break;
      }
      await sleep(300);
    }
    if (replayed?.displayedStep !== 1 || !replayed.completedSteps?.includes(0)) {
      fail(`offline step did not replay: ${JSON.stringify(replayed)}`);
    }
    process.stdout.write("browser-cooking-reload-ok\n");
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
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    }).catch(() => undefined);
  }
}

run().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
