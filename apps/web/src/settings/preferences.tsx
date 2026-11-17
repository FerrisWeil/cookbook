import {
  THEME_STORAGE_KEY,
  applyDocumentTheme,
  readThemeChoice,
  resolveTheme,
  type ThemeChoice,
} from "@cookbook/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { PrototypeViewMode } from "../prototype/prototypeSession";

export const SETTINGS_STORAGE_KEY = "cookbook-settings-v1";

export const TIMER_CHECKPOINT_OPTIONS = [
  { seconds: 300, label: "5 min before" },
  { seconds: 60, label: "1 min before" },
  { seconds: 30, label: "30 sec before" },
  { seconds: 0, label: "Complete (00:00)" },
] as const;

export type CookingPreferences = {
  autoAdvanceStep: boolean;
  autoCollapseCompletedSteps: boolean;
  timerSoundEnabled: boolean;
  timerChimeCheckpoints: number[];
  showReadyAtTime: boolean;
  autoOpenTimersOnFinish: boolean;
};

export const DEFAULT_COOKING_PREFERENCES: CookingPreferences = {
  autoAdvanceStep: true,
  autoCollapseCompletedSteps: true,
  timerSoundEnabled: true,
  timerChimeCheckpoints: [60, 0],
  showReadyAtTime: false,
  autoOpenTimersOnFinish: true,
};

export type PrototypeControlsBinding = {
  mode: PrototypeViewMode;
  onChangeMode: (mode: PrototypeViewMode) => void;
  onResetAll: () => void;
};

export type PreferencesContextValue = {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (choice: ThemeChoice) => void;
  cooking: CookingPreferences;
  updateCooking: (patch: Partial<CookingPreferences>) => void;
  prototype?: PrototypeControlsBinding;
};

export function initialThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") {
    return "dark";
  }
  const param = new URLSearchParams(window.location.search).get("theme");
  if (param === "light" || param === "dark" || param === "system") {
    return param;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      return raw;
    }
  } catch {
    // Ignore storage failures.
  }
  return "dark";
}

function writeThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Ignore storage failures.
  }
}

export function loadCookingPreferences(): CookingPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_COOKING_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_COOKING_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<CookingPreferences>;
    const checkpoints = Array.isArray(parsed.timerChimeCheckpoints)
      ? parsed.timerChimeCheckpoints.filter(
          (item): item is number =>
            typeof item === "number" && Number.isFinite(item) && item >= 0,
        )
      : DEFAULT_COOKING_PREFERENCES.timerChimeCheckpoints;
    return {
      autoAdvanceStep:
        typeof parsed.autoAdvanceStep === "boolean"
          ? parsed.autoAdvanceStep
          : DEFAULT_COOKING_PREFERENCES.autoAdvanceStep,
      autoCollapseCompletedSteps:
        typeof parsed.autoCollapseCompletedSteps === "boolean"
          ? parsed.autoCollapseCompletedSteps
          : DEFAULT_COOKING_PREFERENCES.autoCollapseCompletedSteps,
      timerSoundEnabled:
        typeof parsed.timerSoundEnabled === "boolean"
          ? parsed.timerSoundEnabled
          : DEFAULT_COOKING_PREFERENCES.timerSoundEnabled,
      timerChimeCheckpoints: checkpoints,
      showReadyAtTime:
        typeof parsed.showReadyAtTime === "boolean"
          ? parsed.showReadyAtTime
          : DEFAULT_COOKING_PREFERENCES.showReadyAtTime,
      autoOpenTimersOnFinish:
        typeof parsed.autoOpenTimersOnFinish === "boolean"
          ? parsed.autoOpenTimersOnFinish
          : DEFAULT_COOKING_PREFERENCES.autoOpenTimersOnFinish,
    };
  } catch {
    return DEFAULT_COOKING_PREFERENCES;
  }
}

function saveCookingPreferences(prefs: CookingPreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}

function currentResolvedTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") {
    return choice;
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return resolveTheme(
      choice,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }
  return "dark";
}

function applyThemeToDocument(choice: ThemeChoice): "light" | "dark" {
  const resolved = currentResolvedTheme(choice);
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="theme-color"]');
    applyDocumentTheme(document.documentElement, resolved, meta);
  }
  return resolved;
}

let sharedAudioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  try {
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function primeTimerAudio(): void {
  ensureAudioContext();
}

export function playTimerChime(kind: "reminder" | "complete" = "complete"): boolean {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return false;
  }
  try {
    const now = ctx.currentTime;
    const notes = kind === "reminder" ? [587.33] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(
        kind === "reminder" ? 0.1 : 0.15,
        now + idx * 0.14 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.38);
    });
    return true;
  } catch {
    return false;
  }
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
  prototype,
}: {
  children: ReactNode;
  prototype?: PrototypeControlsBinding;
}) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => initialThemeChoice());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    currentResolvedTheme(initialThemeChoice()),
  );
  const [cooking, setCooking] = useState<CookingPreferences>(() =>
    loadCookingPreferences(),
  );

  useEffect(() => {
    setResolvedTheme(applyThemeToDocument(theme));
    writeThemeChoice(theme);
    if (
      theme !== "system" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setResolvedTheme(applyThemeToDocument("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeState(choice);
  }, []);

  const updateCooking = useCallback((patch: Partial<CookingPreferences>) => {
    setCooking((prev) => {
      const next = { ...prev, ...patch };
      saveCookingPreferences(next);
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        cooking,
        updateCooking,
        prototype,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (ctx) {
    return ctx;
  }
  const fallbackTheme =
    typeof window === "undefined" ? "dark" : readThemeChoice(window.localStorage);
  return {
    theme: fallbackTheme === "system" ? "dark" : fallbackTheme,
    resolvedTheme: currentResolvedTheme(
      fallbackTheme === "system" ? "dark" : fallbackTheme,
    ),
    setTheme: () => {},
    cooking: DEFAULT_COOKING_PREFERENCES,
    updateCooking: () => {},
  };
}
