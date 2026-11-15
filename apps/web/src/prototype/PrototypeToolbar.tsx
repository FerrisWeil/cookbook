import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  applyDocumentTheme,
  readThemeChoice,
  resolveTheme,
  type ThemeChoice,
} from "@cookbook/ui";
import { useEffect, useState } from "react";

import type { PrototypeKitchen } from "./kitchen";
import type { PrototypeLibraryState } from "./types";

const LIBRARY_STATES: Array<{ id: PrototypeLibraryState; label: string }> = [
  { id: "ok", label: "Default library" },
  { id: "empty", label: "Empty library" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error" },
];

const THEMES: Array<{ id: ThemeChoice; label: string }> = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function PrototypeToolbar({ kitchen }: { kitchen: PrototypeKitchen }) {
  const [, setTick] = useState(0);
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => kitchen.subscribe(() => setTick((value) => value + 1)), [kitchen]);
  useEffect(() => {
    setTheme(readThemeChoice(storage()));
  }, []);

  const libraryState = kitchen.libraryState();

  return (
    <div className="proto-banner">
      <strong>Prototype (never merged)</strong>
      <span>Sample data only. Ideas move to Linear issues on master.</span>
      <fieldset className="proto-banner-states">
        <legend>Library state</legend>
        {LIBRARY_STATES.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name="proto-library"
              checked={libraryState === item.id}
              onChange={() => kitchen.setLibraryState(item.id)}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="proto-banner-theme">
        <legend>Theme</legend>
        {THEMES.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name="proto-theme"
              checked={theme === item.id}
              onChange={() => {
                setTheme(item.id);
                writeTheme(item.id);
              }}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function writeTheme(choice: ThemeChoice): void {
  const store = storage();
  try {
    if (choice === "system") {
      store?.removeItem(THEME_STORAGE_KEY);
    } else {
      store?.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // Prototype theme is best-effort.
  }
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(choice, prefersDark);
  if (typeof document !== "undefined") {
    applyDocumentTheme(
      document.documentElement,
      resolved,
      document.querySelector('meta[name="theme-color"]'),
    );
  }
  void THEME_COLORS;
}
