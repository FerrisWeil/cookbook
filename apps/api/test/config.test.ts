import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config.ts";

describe("api config", () => {
  it("refuses to start without DATABASE_URL", () => {
    assert.throws(() => loadConfig({ PORT: "3000" }), /DATABASE_URL is required/);
  });

  it("reads bind address, port, and migration paths", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://cookbook:cookbook@db:5432/cookbook",
      BIND_HOST: "0.0.0.0",
      PORT: "3000",
      MIGRATIONS_DIR: "/app/db/migrations",
      SEED_FILE: "/app/db/seed.sql",
    });
    assert.equal(config.bindHost, "0.0.0.0");
    assert.equal(config.port, 3000);
    assert.equal(config.migrationsDir, "/app/db/migrations");
    assert.equal(config.seedFile, "/app/db/seed.sql");
  });
});
