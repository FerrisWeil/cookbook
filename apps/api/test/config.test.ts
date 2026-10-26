import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config.ts";

describe("api config", () => {
  it("refuses to start without a database url or password parts", () => {
    assert.throws(
      () => loadConfig({ PORT: "3000" }),
      /DATABASE_URL or both POSTGRES_USER and POSTGRES_PASSWORD are required/,
    );
  });

  it("keeps an already encoded DATABASE_URL", () => {
    const databaseUrl = "postgres://cookbook:cook%40book@db:5432/cookbook";
    const config = loadConfig({
      DATABASE_URL: databaseUrl,
      POSTGRES_PASSWORD: "ignored",
    });
    assert.equal(config.databaseUrl, databaseUrl);
  });

  it("encodes a password that contains @ and : into a usable URL", () => {
    const password = "p@ss:w/ord#1";
    const config = loadConfig({
      POSTGRES_USER: "cookbook",
      POSTGRES_PASSWORD: password,
      POSTGRES_HOST: "db",
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "cookbook",
    });
    const url = new URL(config.databaseUrl);
    assert.equal(
      config.databaseUrl,
      "postgres://cookbook:p%40ss%3Aw%2Ford%231@db:5432/cookbook",
    );
    assert.equal(url.protocol, "postgres:");
    assert.equal(decodeURIComponent(url.username), "cookbook");
    assert.equal(decodeURIComponent(url.password), password);
    assert.equal(url.hostname, "db");
    assert.equal(url.port, "5432");
    assert.equal(url.pathname, "/cookbook");
    assert.equal(url.hash, "");
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
