import { Button } from "@cookbook/ui";
import { useCallback, useEffect, useState } from "react";

import { App } from "../App";
import { PreferencesProvider, usePreferences } from "../settings/preferences";
import { createPrototypeCookingClient, type PrototypeCookingClient } from "./cookingStore";
import {
  createPrototypeController,
  type PrototypeController,
  type PrototypeViewMode,
} from "./prototypeSession";

export function PrototypeApp() {
  const [controller] = useState<PrototypeController>(() =>
    createPrototypeController(
      typeof window === "undefined" ? "" : window.location.search,
    ),
  );
  const [cooking] = useState<PrototypeCookingClient>(() =>
    createPrototypeCookingClient({
      findRecipe: (id) => controller.findRecipe(id),
    }),
  );
  const [mode, setMode] = useState<PrototypeViewMode>(() => controller.getMode());

  useEffect(() => {
    return controller.subscribe(() => {
      setMode(controller.getMode());
    });
  }, [controller]);

  const selectMode = useCallback(
    (next: PrototypeViewMode) => {
      if (
        next === "empty" &&
        typeof window !== "undefined" &&
        window.location.pathname === "/" &&
        window.location.search !== ""
      ) {
        window.history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      controller.setMode(next);
    },
    [controller],
  );

  const resetAll = useCallback(() => {
    void controller.resetFacts();
    void cooking.end();
  }, [controller, cooking]);

  return (
    <PreferencesProvider
      prototype={{
        mode,
        onChangeMode: selectMode,
        onResetAll: resetAll,
      }}
    >
      <PrototypeShell
        controller={controller}
        cooking={cooking}
        mode={mode}
        onSelectMode={selectMode}
        onResetAll={resetAll}
      />
    </PreferencesProvider>
  );
}

function PrototypeShell({
  controller,
  cooking,
  mode,
  onSelectMode,
  onResetAll,
}: {
  controller: PrototypeController;
  cooking: PrototypeCookingClient;
  mode: PrototypeViewMode;
  onSelectMode: (next: PrototypeViewMode) => void;
  onResetAll: () => void;
}) {
  const { theme, setTheme } = usePreferences();
  const [open, setOpen] = useState<boolean>(() => mode !== "normal");

  return (
    <div className="prototype-frame">
      <aside className="prototype-bar" aria-label="Prototype controls">
        <div className="prototype-bar-row">
          <div className="prototype-bar-title">
            <span className="prototype-pill">Prototype · TAY-36</span>
            <span className="prototype-note">
              Sample data only (no API/DB). Never merged to master.
            </span>
          </div>
          <div className="prototype-bar-summary">
            {mode !== "normal" ? (
              <span className="prototype-active-flag">{`State: ${mode}`}</span>
            ) : null}
            <Button
              variant="quiet"
              className="prototype-toggle-btn"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              {open ? "Hide controls" : "Prototype controls"}
            </Button>
          </div>
        </div>

        {open ? (
          <div className="prototype-controls-panel">
            <div className="prototype-control-group">
              <span className="prototype-control-label">View state:</span>
              <div
                className="prototype-control-buttons"
                role="group"
                aria-label="Simulated view state"
              >
                {(
                  [
                    { id: "normal", label: "Normal (25)" },
                    { id: "empty", label: "Empty library" },
                    { id: "loading", label: "Loading" },
                    { id: "error", label: "Error / retry" },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    variant={mode === item.id ? "primary" : "tonal"}
                    onClick={() => onSelectMode(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="prototype-control-group">
              <span className="prototype-control-label">Theme:</span>
              <div
                className="prototype-control-buttons"
                role="group"
                aria-label="Theme override"
              >
                {(
                  [
                    { id: "dark", label: "Dark" },
                    { id: "light", label: "Light" },
                    { id: "system", label: "System" },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    variant={theme === item.id ? "primary" : "tonal"}
                    onClick={() => setTheme(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="prototype-control-group">
              <Button variant="quiet" onClick={onResetAll}>
                Reset edits &amp; session
              </Button>
            </div>
          </div>
        ) : null}
      </aside>

      <App session={controller.session} cooking={cooking} />
    </div>
  );
}
