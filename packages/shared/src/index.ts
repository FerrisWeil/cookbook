export type LiveStatus = {
  status: "ok";
};

export type ReadyStatus = {
  status: "ok" | "degraded";
  database: "up" | "down";
  seed: boolean;
};

export type HelloResult = {
  name: string;
  message: string;
};

export function isStackReady(ready: ReadyStatus): boolean {
  return ready.status === "ok" && ready.database === "up" && ready.seed;
}
