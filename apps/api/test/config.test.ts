import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifies } from "@cookbook/test";

import { loadConfig } from "../src/config.ts";

const CALLER_TOKENS = {
  API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
  API_AUTH_TOKEN_WEB: "test-api-web-token-xx",
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("api config", () => {
  it("refuses to start without app and migrator credentials", () => {
    assert.throws(
      () => loadConfig({ PORT: "3000", ...CALLER_TOKENS }),
      /DATABASE_URL and MIGRATOR_DATABASE_URL, or POSTGRES_APP_USER, POSTGRES_APP_PASSWORD, POSTGRES_MIGRATOR_USER, and POSTGRES_MIGRATOR_PASSWORD, are required/,
    );
  });

  it("refuses a single database url", () => {
    assert.throws(
      () =>
        loadConfig({
          DATABASE_URL: "postgres://cookbook_app:secret@db:5432/cookbook",
          ...CALLER_TOKENS,
        }),
      /DATABASE_URL and MIGRATOR_DATABASE_URL must both be set/,
    );
  });

  it("refuses identical app and migrator urls", () => {
    const url = "postgres://cookbook_app:secret@db:5432/cookbook";
    assert.throws(
      () =>
        loadConfig({
          DATABASE_URL: url,
          MIGRATOR_DATABASE_URL: url,
          ...CALLER_TOKENS,
        }),
      /migrator and app database urls must be different/,
    );
  });

  it("keeps encoded urls when both roles are set", () => {
    const databaseUrl = "postgres://cookbook_app:cook%40book@db:5432/cookbook";
    const migratorDatabaseUrl =
      "postgres://cookbook_migrator:other%40secret@db:5432/cookbook";
    const config = loadConfig({
      DATABASE_URL: databaseUrl,
      MIGRATOR_DATABASE_URL: migratorDatabaseUrl,
      ...CALLER_TOKENS,
    });
    assert.equal(config.databaseUrl, databaseUrl);
    assert.equal(config.migratorDatabaseUrl, migratorDatabaseUrl);
  });

  it("encodes app and migrator passwords into separate urls", () => {
    const config = loadConfig({
      POSTGRES_APP_USER: "cookbook_app",
      POSTGRES_APP_PASSWORD: "p@ss:w/ord#1",
      POSTGRES_MIGRATOR_USER: "cookbook_migrator",
      POSTGRES_MIGRATOR_PASSWORD: "migr@te:me",
      POSTGRES_HOST: "db",
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "cookbook",
      ...CALLER_TOKENS,
    });
    const app = new URL(config.databaseUrl);
    const migrator = new URL(config.migratorDatabaseUrl);
    assert.equal(decodeURIComponent(app.username), "cookbook_app");
    assert.equal(decodeURIComponent(app.password), "p@ss:w/ord#1");
    assert.equal(decodeURIComponent(migrator.username), "cookbook_migrator");
    assert.equal(decodeURIComponent(migrator.password), "migr@te:me");
    assert.equal(app.hostname, "db");
    assert.equal(migrator.pathname, "/cookbook");
    assert.notEqual(config.databaseUrl, config.migratorDatabaseUrl);
  });

  it("refuses an empty password inside a database url", () => {
    assert.throws(
      () =>
        loadConfig({
          DATABASE_URL: "postgres://cookbook_app:@db:5432/cookbook",
          MIGRATOR_DATABASE_URL:
            "postgres://cookbook_migrator:other-secret@db:5432/cookbook",
          ...CALLER_TOKENS,
        }),
      /DATABASE_URL is required/,
    );
  });

  it("refuses a known password inside a database url", () => {
    assert.throws(
      () =>
        loadConfig({
          DATABASE_URL: "postgres://cookbook_app:cookbook@db:5432/cookbook",
          MIGRATOR_DATABASE_URL:
            "postgres://cookbook_migrator:other-secret@db:5432/cookbook",
          ...CALLER_TOKENS,
        }),
      /DATABASE_URL is a placeholder or the old shared dev password/,
    );
  });

  it("refuses the placeholder and the old shared password", () => {
    for (const password of ["replace-me", "cookbook"]) {
      assert.throws(
        () =>
          loadConfig({
            POSTGRES_APP_USER: "cookbook_app",
            POSTGRES_APP_PASSWORD: password,
            POSTGRES_MIGRATOR_USER: "cookbook_migrator",
            POSTGRES_MIGRATOR_PASSWORD: "a-real-migrator-secret",
            ...CALLER_TOKENS,
          }),
        /POSTGRES_APP_PASSWORD is a placeholder or the old shared dev password/,
      );
    }
  });

  it("refuses to start without API caller tokens", () => {
    const database = {
      DATABASE_URL: "postgres://cookbook_app:secret@db:5432/cookbook",
      MIGRATOR_DATABASE_URL:
        "postgres://cookbook_migrator:other@db:5432/cookbook",
    };
    assert.throws(() => loadConfig(database), /API_AUTH_TOKEN_MCP is required/);
    assert.throws(
      () => loadConfig({ ...database, API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx" }),
      /API_AUTH_TOKEN_WEB is required/,
    );
  });

  it("refuses identical caller tokens and tokens that match MCP_AUTH_TOKEN", () => {
    const database = {
      DATABASE_URL: "postgres://cookbook_app:secret@db:5432/cookbook",
      MIGRATOR_DATABASE_URL:
        "postgres://cookbook_migrator:other@db:5432/cookbook",
    };
    assert.throws(
      () =>
        loadConfig({
          ...database,
          API_AUTH_TOKEN_MCP: "test-api-mcp-token-xx",
          API_AUTH_TOKEN_WEB: "test-api-mcp-token-xx",
        }),
      /API_AUTH_TOKEN_MCP and API_AUTH_TOKEN_WEB must differ/,
    );
    assert.throws(
      () =>
        loadConfig({
          ...database,
          ...CALLER_TOKENS,
          MCP_AUTH_TOKEN: "test-api-mcp-token-xx",
        }),
      /API caller tokens must differ from MCP_AUTH_TOKEN/,
    );
  });

  it("allows local caller tokens only when API_ALLOW_DEV_TOKEN=1", () => {
    const database = {
      DATABASE_URL: "postgres://cookbook_app:secret@db:5432/cookbook",
      MIGRATOR_DATABASE_URL:
        "postgres://cookbook_migrator:other@db:5432/cookbook",
    };
    assert.throws(
      () =>
        loadConfig({
          ...database,
          API_AUTH_TOKEN_MCP: "local-dev-api-mcp-token-not-for-nas",
          API_AUTH_TOKEN_WEB: "local-dev-api-web-token-not-for-nas",
        }),
      /API_ALLOW_DEV_TOKEN=1/,
    );
    const config = loadConfig({
      ...database,
      API_AUTH_TOKEN_MCP: "local-dev-api-mcp-token-not-for-nas",
      API_AUTH_TOKEN_WEB: "local-dev-api-web-token-not-for-nas",
      API_ALLOW_DEV_TOKEN: "1",
    });
    assert.equal(config.apiAuthTokenMcp, "local-dev-api-mcp-token-not-for-nas");
    assert.equal(config.apiAuthTokenWeb, "local-dev-api-web-token-not-for-nas");
  });

  it("reads bind address, port, and migration paths", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://cookbook_app:secret@db:5432/cookbook",
      MIGRATOR_DATABASE_URL:
        "postgres://cookbook_migrator:other@db:5432/cookbook",
      BIND_HOST: "0.0.0.0",
      PORT: "3000",
      MIGRATIONS_DIR: "/app/db/migrations",
      SEED_FILE: "/app/db/seed.sql",
      ...CALLER_TOKENS,
    });
    assert.equal(config.bindHost, "0.0.0.0");
    assert.equal(config.port, 3000);
    assert.equal(config.migrationsDir, "/app/db/migrations");
    assert.equal(config.seedFile, "/app/db/seed.sql");
  });
});

describe("local supply-chain files", () => {
  it(
    "the request role cannot change the schema",
    verifies("75", "ff426d469064cb1c", () => {
      const script = readFileSync(join(repoRoot, "db/init/01-roles.sh"), "utf8");
      assert.match(script, /cookbook_app/);
      assert.match(script, /NOSUPERUSER/);
      assert.doesNotMatch(script, /GRANT CREATE/);
    }),
  );

  it(
    "the migrator is a different role",
    verifies("76", "c78249a06dc160cb", () => {
      const script = readFileSync(join(repoRoot, "db/init/01-roles.sh"), "utf8");
      assert.match(script, /cookbook_migrator/);
      assert.match(script, /cookbook_app/);
      assert.notEqual(
        script.includes("cookbook_migrator") && script.includes("cookbook_app"),
        false,
      );
    }),
  );

  it(
    "the image superuser is used only to initialize the database",
    verifies("77", "791e5cd76c5ba8df", () => {
      const script = readFileSync(join(repoRoot, "db/init/01-roles.sh"), "utf8");
      assert.match(script, /NOSUPERUSER/);
      assert.doesNotMatch(script, /PASSWORD 'cookbook'/);
      assert.doesNotMatch(script, /:-cookbook/);
    }),
  );

  it(
    "does not publish Postgres or fall back to the old password",
    verifies("74", "38d3682bcad65d8e", () => {
      const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8");
      assert.doesNotMatch(compose, /5432:5432/);
      assert.doesNotMatch(compose, /:-cookbook/);
      assert.match(compose, /cookbook_app/);
      assert.match(compose, /cookbook_migrator/);
      assert.match(compose, /internal:\s*true/);
    }),
  );

  it(
    ".env.example holds placeholders and no real secret",
    verifies("72", "4b113974714836df", () => {
      const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
      assert.match(example, /replace-with-a-long-random-token/);
      assert.match(example, /replace-me/);
    }),
  );

  it(
    "the local MCP token is a documented placeholder",
    verifies("79", "7004af68e72576c8", () => {
      const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
      assert.match(example, /local-dev-token-not-for-nas|MCP_ALLOW_DEV_TOKEN/);
    }),
  );

  it("pins third-party image tags to digests", () => {
    for (const relative of [
      "docker/api.Dockerfile",
      "docker/mcp.Dockerfile",
      "docker/web.Dockerfile",
      "docker-compose.yml",
    ]) {
      const source = readFileSync(join(repoRoot, relative), "utf8");
      const images = source.match(/^[ \t]*(?:FROM|image:)\s+\S+/gm) ?? [];
      assert.ok(images.length > 0, relative);
      for (const image of images) {
        assert.match(
          image,
          /@sha256:[a-f0-9]{64}(?:\s+AS\s+\S+)?$/,
          `${relative} ${image}`,
        );
      }
    }
  });
});
