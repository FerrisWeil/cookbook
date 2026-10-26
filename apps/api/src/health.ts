import type { ReadyStatus } from "@cookbook/shared";

import type { SqlClient } from "./migrate.js";

export async function getReadyStatus(client: SqlClient): Promise<ReadyStatus> {
  try {
    const result = await client.query(
      "SELECT value FROM app_meta WHERE key = $1",
      ["seeded"],
    );
    const seed = result.rows[0]?.["value"] === "true";
    return {
      status: seed ? "ok" : "degraded",
      database: "up",
      seed,
    };
  } catch {
    return { status: "degraded", database: "down", seed: false };
  }
}
