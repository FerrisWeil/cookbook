export const THEME_STORAGE_KEY = "cookbook-theme";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f5f9fc",
  dark: "#0b1a2c",
};

export function readThemeChoice(storage: Pick<Storage, "getItem"> | null): ThemeChoice {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") {
      return value;
    }
    return "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): ResolvedTheme {
  if (choice === "light" || choice === "dark") {
    return choice;
  }
  return prefersDark ? "dark" : "light";
}

export function applyDocumentTheme(
  root: Pick<HTMLElement, "dataset" | "style">,
  theme: ResolvedTheme,
  themeColor?: { setAttribute: (name: string, value: string) => void } | null,
): void {
  root.dataset["theme"] = theme;
  root.style.colorScheme = theme;
  themeColor?.setAttribute("content", THEME_COLORS[theme]);
}
