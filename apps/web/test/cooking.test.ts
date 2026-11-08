import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MESSAGES, type CookingSession } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import {
  createCookingClient,
  memorySessionCache,
  type CookingNetwork,
  type CookingStream,
  type SessionCache,
} from "../src/cooking/client.ts";
import { RecipeScreen } from "../src/RecipeScreen.tsx";
import { emptyRecipeFacts } from "@cookbook/shared";
import { memoryLock, memoryStorage } from "../src/sync/ports.ts";
import type { Mutation } from "../src/sync/types.ts";

function session(overrides: Partial<CookingSession> = {}): CookingSession {
  return {
    id: "session-1",
    recipeId: "soup",
    status: "active",
    snapshot: {
      title: "Example: Soup",
      servings: 2,
      ingredients: ["1 onion"],
      steps: ["Chop.", "Simmer."],
    },
    displayedStep: 0,
    completedSteps: [],
    ...overrides,
  };
}

function harness(options: {
  session: CookingSession;
  online?: boolean;
  stream?: CookingStream;
  sessions?: SessionCache;
  storage?: ReturnType<typeof memoryStorage>;
  now?: () => number;
  schedule?: (delayMs: number, run: () => void) => () => void;
  resume?: CookingNetwork["resume"];
  end?: CookingNetwork["end"];
  onSend?: (mutation: Mutation) => Promise<
    | { ok: true; kind: "applied" | "duplicate" }
    | { ok: false; kind: "transient" | "permanent"; message: string }
  >;
}) {
  let current = session(options.session);
  const sent: Mutation[] = [];
  let begins = 0;
  let ends = 0;
  const storage = options.storage ?? memoryStorage();
  const network: CookingNetwork = {
    resume:
      options.resume ??
      (async () => ({
        ok: true as const,
        session: current.status === "active" ? structuredClone(current) : null,
      })),
    async begin() {
      begins += 1;
      return { ok: true, session: current };
    },
    end:
      options.end ??
      (async () => {
        ends += 1;
        current = { ...current, status: "finished" };
        return { ok: true as const, session: current };
      }),
    async send(mutation) {
      if (options.onSend) {
        return options.onSend(mutation);
      }
      sent.push(mutation);
      if (typeof mutation.fields["displayedStep"] === "number") {
        current = { ...current, displayedStep: mutation.fields["displayedStep"] };
      }
      for (const [key, value] of Object.entries(mutation.fields)) {
        if (!key.startsWith("completed:")) {
          continue;
        }
        const step = Number(key.slice("completed:".length));
        const completed = new Set(current.completedSteps);
        if (value === true) {
          completed.add(step);
        } else {
          completed.delete(step);
        }
        current = {
          ...current,
          completedSteps: [...completed].sort((left, right) => left - right),
        };
      }
      return { ok: true, kind: "applied" };
    },
  };
  let nextId = 0;
  const client = createCookingClient({
    storage,
    sessions: options.sessions ?? memorySessionCache(),
    lock: memoryLock(),
    network,
    stream: options.stream ?? { connect() {} },
    now: options.now ?? (() => 0),
    schedule: options.schedule,
    id: () => `mutation-${nextId++}`,
  });
  if (options.online === false) {
    client.setConnected(false);
  }
  return {
    client,
    storage,
    sent,
    begins: () => begins,
    ends: () => ends,
    current: () => current,
    replace(next: CookingSession) {
      current = next;
    },
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("cooking session on the device", () => {
  it(
    "replays a step change stored while disconnected",
    verifies("205", "6286367590d2b97d", async () => {
      const first = harness({ session: session(), online: false });
      await first.client.open();
      await first.client.show(1);
      await first.client.completeDisplayed();
      assert.equal(first.sent.length, 0);
      assert.equal((await first.storage.load()).length, 2);
      const second = createCookingClient({
        storage: first.storage,
        sessions: memorySessionCache(),
        lock: memoryLock(),
        network: {
          async resume() {
            return { ok: true, session: session() };
          },
          async begin() {
            throw new Error("start is not a replay");
          },
          async end() {
            throw new Error("finish is not a replay");
          },
          async send(mutation) {
            first.sent.push(mutation);
            return { ok: true, kind: "applied" };
          },
        },
        stream: { connect() {} },
        now: () => 0,
        id: () => "replay",
      });
      await second.open();
      assert.equal(first.sent.length, 2);
      assert.equal(first.sent[0]?.fields["displayedStep"], 1);
      assert.equal(first.sent[1]?.fields["completed:1"], true);
      assert.equal((await first.storage.load()).length, 0);
    }),
  );

  it(
    "rejects start and finish while disconnected",
    verifies("206", "1f6e432581dbcd19", async () => {
      const box = harness({ session: session(), online: false });
      await box.client.open();
      await box.client.begin("other");
      assert.equal(box.client.error(), MESSAGES.sessionOfflineStart);
      assert.equal(box.begins(), 0);
      await box.client.end();
      assert.equal(box.client.error(), MESSAGES.sessionOfflineFinish);
      assert.equal(box.ends(), 0);
      assert.equal((await box.storage.load()).length, 0);
    }),
  );

  it(
    "shows a late write failure and drops the rejected step change",
    verifies("210", "19dfce056805e7df", async () => {
      const box = harness({
        session: session(),
        onSend: async () => ({
          ok: false,
          kind: "permanent",
          message: MESSAGES.sessionEnded,
        }),
      });
      await box.client.open();
      await box.client.completeDisplayed();
      assert.equal(box.client.error(), MESSAGES.sessionEnded);
      assert.deepEqual(box.client.view()?.completedSteps, []);
      const page = renderToString(
        createElement(RecipeScreen, {
          state: {
            kind: "ready",
            recipe: {
              title: "Example: Stew",
              ingredients: ["2 carrots"],
              steps: ["Brown."],
              facts: emptyRecipeFacts(),
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
            session: box.client.view() ?? session(),
            error: box.client.error(),
            onShow() {},
            onComplete() {},
            onUndo() {},
            onFinish() {},
          },
        }),
      );
      assert.match(page, new RegExp(MESSAGES.sessionEnded));
      assert.match(page, /Example: Soup/);
      assert.doesNotMatch(page, /Done\./);
    }),
  );

  it(
    "applies a server session change without a local step command",
    verifies("211", "25e52bf85b5e5a02", async () => {
      let handlers: { onSession(): void } | undefined;
      const box = harness({
        session: session(),
        stream: {
          connect(next) {
            handlers = next;
          },
        },
      });
      await box.client.open();
      box.replace(session({ displayedStep: 1, completedSteps: [0] }));
      handlers?.onSession();
      await settle();
      assert.equal(box.client.view()?.displayedStep, 1);
      assert.deepEqual(box.client.view()?.completedSteps, [0]);
      assert.equal(box.sent.length, 0);
    }),
  );

  it(
    "restores the confirmed session and queued steps after an offline reload",
    verifies("212", "1175a9b17023c820", async () => {
      const cache = memorySessionCache();
      const storage = memoryStorage();
      const first = harness({ session: session(), sessions: cache, storage });
      await first.client.open();
      first.client.setConnected(false);
      await first.client.show(1);
      await first.client.completeDisplayed();
      first.client.close();
      const second = harness({
        session: session(),
        sessions: cache,
        storage,
        online: false,
        resume: async () => ({ ok: false, message: MESSAGES.apiUnavailable }),
      });
      await second.client.open();
      assert.equal(second.client.error(), null);
      assert.equal(second.client.view()?.snapshot.title, "Example: Soup");
      assert.deepEqual(second.client.view()?.snapshot.steps, ["Chop.", "Simmer."]);
      assert.equal(second.client.view()?.displayedStep, 1);
      assert.deepEqual(second.client.view()?.completedSteps, [1]);
      assert.equal((await storage.load()).length, 2);
      second.client.setConnected(true);
      for (let attempt = 0; attempt < 20 && second.sent.length < 2; attempt += 1) {
        await settle();
      }
      assert.equal(second.sent.length, 2);
      assert.equal(second.sent[0]?.fields["displayedStep"], 1);
      assert.equal(second.sent[1]?.fields["completed:1"], true);
    }),
  );

  it(
    "retries a transient step write while the stream stays connected",
    verifies("213", "d6eae1618eb5d9ae", async () => {
      let time = 0;
      let calls = 0;
      let armed: { delayMs: number; run: () => void } | null = null;
      const box = harness({
        session: session(),
        now: () => time,
        schedule(delayMs, run) {
          armed = { delayMs, run };
          return () => {
            if (armed?.run === run) {
              armed = null;
            }
          };
        },
        onSend: async () => {
          calls += 1;
          if (calls === 1) {
            return { ok: false, kind: "transient", message: "Could not reach the kitchen." };
          }
          return { ok: true, kind: "applied" };
        },
      });
      await box.client.open();
      await box.client.completeDisplayed();
      assert.equal(calls, 1);
      assert.equal(armed?.delayMs, 1000);
      assert.deepEqual(box.client.view()?.completedSteps, [0]);
      time = 1000;
      const retry = armed?.run;
      assert.ok(retry);
      retry();
      for (let attempt = 0; attempt < 30 && (await box.storage.load()).length > 0; attempt += 1) {
        await Promise.resolve();
      }
      assert.equal(calls, 2);
      assert.equal((await box.storage.load()).length, 0);
    }),
  );

  it(
    "keeps the active session when finish is not confirmed",
    verifies("214", "714e351c40b62940", async () => {
      let finishes = 0;
      const box = harness({
        session: session(),
        end: async () => {
          finishes += 1;
          return { ok: false, message: MESSAGES.apiUnavailable };
        },
      });
      await box.client.open();
      await box.client.end();
      assert.equal(finishes, 1);
      assert.equal(box.client.error(), MESSAGES.apiUnavailable);
      assert.equal(box.client.view()?.id, "session-1");
      assert.equal(box.client.view()?.snapshot.title, "Example: Soup");
      assert.equal((await box.storage.load()).length, 0);
      box.client.setConnected(false);
      await box.client.end();
      assert.equal(finishes, 1);
      assert.equal(box.client.view()?.id, "session-1");
      assert.equal((await box.storage.load()).length, 0);
    }),
  );

  it(
    "ignores a slower refresh after a newer session or a finish",
    verifies("215", "b32bdfb19e54eea0", async () => {
      let handlers: { onSession(): void } | undefined;
      let releaseStale: (() => void) | undefined;
      const staleGate = new Promise<void>((resolve) => {
        releaseStale = resolve;
      });
      let resumes = 0;
      const box = harness({
        session: session(),
        stream: {
          connect(next) {
            handlers = next;
          },
        },
        resume: async () => {
          resumes += 1;
          const call = resumes;
          if (call === 2) {
            await staleGate;
            return { ok: true, session: session({ displayedStep: 0 }) };
          }
          if (call === 3) {
            return { ok: true, session: session({ displayedStep: 1, completedSteps: [0] }) };
          }
          if (call > 3) {
            return { ok: true, session: session() };
          }
          return { ok: true, session: session() };
        },
      });
      await box.client.open();
      handlers?.onSession();
      handlers?.onSession();
      for (let attempt = 0; attempt < 20 && box.client.view()?.displayedStep !== 1; attempt += 1) {
        await settle();
      }
      assert.equal(box.client.view()?.displayedStep, 1);
      assert.deepEqual(box.client.view()?.completedSteps, [0]);
      releaseStale?.();
      await settle();
      await settle();
      assert.equal(box.client.view()?.displayedStep, 1);
      await box.client.end();
      assert.equal(box.client.view(), null);
      handlers?.onSession();
      await settle();
      await settle();
      assert.equal(box.client.view(), null);
      assert.equal(box.ends(), 1);
    }),
  );
});
