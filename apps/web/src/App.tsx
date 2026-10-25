import { isStackReady, type ReadyStatus } from "@cookbook/shared";
import { useEffect, useState } from "react";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; status: ReadyStatus };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health/ready", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as ReadyStatus;
        setState({ kind: "ready", status: body });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "unknown error";
        setState({ kind: "error", message });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <p className="eyebrow">At home</p>
      <h1>Cookbook</h1>
      <p className="lede">
        Family recipes for planning meals. Chef saves the ones worth keeping.
      </p>
      <StatusCard state={state} />
    </main>
  );
}

function StatusCard({ state }: { state: LoadState }) {
  if (state.kind === "loading") {
    return <p className="status">Checking the stack…</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="status status-bad">
        Cannot reach the API ({state.message}).
      </p>
    );
  }
  if (isStackReady(state.status)) {
    return (
      <p className="status status-ok">
        Stack is up. Database is ready with seed data.
      </p>
    );
  }
  return (
    <p className="status status-bad">
      API reached, database {state.status.database}, seed{" "}
      {state.status.seed ? "present" : "missing"}.
    </p>
  );
}
