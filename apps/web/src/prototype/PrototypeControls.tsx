import {
  Button,
  THEME_STORAGE_KEY,
  applyDocumentTheme,
  readThemeChoice,
  resolveTheme,
  type ThemeChoice,
} from "@cookbook/ui";
import { useEffect, useState } from "react";

import { App } from "../App";
import { createPrototypeCookingClient, type PrototypeCookingClient } from "./cookingStore";
import {
  createPrototypeController,
  type PrototypeController,
  type PrototypeViewMode,
} from "./prototypeSession";

function initialThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") {
    return "system";
  }
  const param = new URLSearchParams(window.location.search).get("theme");
  if (param === "light" || param === "dark" || param === "system") {
    return param;
  }
  return readThemeChoice(window.localStorage);
}

function writeThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (choice === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // Ignore storage failures.
  }
}

function applyTheme(choice: ThemeChoice): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(choice, prefersDark);
  const meta = document.querySelector('meta[name="theme-color"]');
  applyDocumentTheme(document.documentElement, resolved, meta);
}

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
  const [theme, setTheme] = useState<ThemeChoice>(() => initialThemeChoice());
  const [open, setOpen] = useState<boolean>(() => controller.getMode() !== "normal");

  useEffect(() => {
    return controller.subscribe(() => {
      setMode(controller.getMode());
    });
  }, [controller]);

  useEffect(() => {
    applyTheme(theme);
    writeThemeChoice(theme);
    if (theme !== "system" || typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function selectMode(next: PrototypeViewMode) {
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
  }

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
              <div className="prototype-control-buttons" role="group" aria-label="Simulated view state">
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
                    onClick={() => selectMode(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="prototype-control-group">
              <span className="prototype-control-label">Theme:</span>
              <div className="prototype-control-buttons" role="group" aria-label="Theme override">
                {(
                  [
                    { id: "system", label: "System" },
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
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
              <Button
                variant="quiet"
                onClick={() => {
                  void controller.resetFacts();
                  void cooking.end();
                }}
              >
                Reset edits & session
              </Button>
            </div>
          </div>
        ) : null}
      </aside>

      <App session={controller.session} cooking={cooking} />
    </div>
  );
}
