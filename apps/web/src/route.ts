export type AppRoute =
  | { name: "list" }
  | { name: "recipe"; id: string }
  | { name: "unknown" };

export function parseRoute(pathname: string): AppRoute {
  if (pathname === "/" || pathname === "") {
    return { name: "list" };
  }
  const match = /^\/recipes\/([^/]+)$/.exec(pathname);
  if (!match) {
    return { name: "unknown" };
  }
  try {
    const id = decodeURIComponent(match[1] ?? "").trim();
    if (id === "") {
      return { name: "unknown" };
    }
    return { name: "recipe", id };
  } catch {
    return { name: "unknown" };
  }
}

export function recipePath(id: string): string {
  return `/recipes/${encodeURIComponent(id)}`;
}
