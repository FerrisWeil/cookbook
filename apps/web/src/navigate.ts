export const COOKBOOK_HISTORY = { cookbook: true as const };

export type CookbookHistory = {
  state: unknown;
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  back(): void;
};

export type CookbookLocation = {
  pathname: string;
};

export function isCookbookHistoryState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "cookbook" in state &&
    (state as { cookbook: unknown }).cookbook === true
  );
}

export function rememberListPosition(
  history: CookbookHistory,
  href: string,
  scroll: number,
): void {
  history.replaceState({ cookbook: true, scroll }, "", href);
}

export function listScrollFromState(state: unknown): number | undefined {
  if (
    typeof state === "object" &&
    state !== null &&
    "scroll" in state &&
    typeof (state as { scroll: unknown }).scroll === "number"
  ) {
    return (state as { scroll: number }).scroll;
  }
  return undefined;
}

export function pushAppPath(
  to: string,
  history: CookbookHistory,
  location: CookbookLocation,
): void {
  if (location.pathname !== to) {
    history.pushState(COOKBOOK_HISTORY, "", to);
  }
}

export function leaveRecipe(history: CookbookHistory): "pop" | "replace" {
  if (isCookbookHistoryState(history.state)) {
    history.back();
    return "pop";
  }
  history.replaceState(null, "", "/");
  return "replace";
}
