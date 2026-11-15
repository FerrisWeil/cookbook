export function isSampleDataMode(): boolean {
  const env = import.meta.env as { VITE_SAMPLE_DATA?: string } | undefined;
  return env?.VITE_SAMPLE_DATA === "1";
}

export function protoStateFromSearch(
  search: string,
): "ok" | "empty" | "loading" | "error" | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(raw).get("proto");
  if (value === "empty" || value === "loading" || value === "error") {
    return value;
  }
  if (value === "ok" || value === "default") {
    return "ok";
  }
  return null;
}
