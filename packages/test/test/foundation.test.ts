import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { covers } from "../src/covers.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

describe("local compose stack", () => {
  it("starts web, the API, Postgres, and MCP and checks health", () => {
    covers("6.1.1", "6.6.2");

    const pkg = JSON.parse(readRepo("package.json")) as {
      scripts: Record<string, string>;
    };
    assert.equal(pkg.scripts.smoke, "bash scripts/smoke.sh");

    const compose = parse(readRepo("docker-compose.yml")) as {
      services?: Record<string, { healthcheck?: unknown; image?: string }>;
    };
    const services = compose.services ?? {};
    assert.deepEqual(Object.keys(services).sort(), ["api", "db", "mcp", "web"]);
    assert.equal(typeof services.db?.healthcheck, "object");
    assert.match(String(services.db?.image ?? ""), /^postgres:/);

    for (const relative of [
      "docker/api.Dockerfile",
      "docker/mcp.Dockerfile",
      "docker/web.Dockerfile",
    ]) {
      assert.match(readRepo(relative), /^HEALTHCHECK /m, relative);
    }

    const smoke = readRepo("scripts/smoke.sh");
    assert.match(smoke, /docker compose up --build/);
    assert.match(smoke, /127\.0\.0\.1:3000\/health/);
    assert.match(smoke, /127\.0\.0\.1:3000\/health\/ready/);
    assert.match(smoke, /127\.0\.0\.1:8787\/health/);
    assert.match(smoke, /127\.0\.0\.1:8080/);
    assert.match(smoke, /"database":"up"/);
    assert.match(smoke, /psql /);
  });
});

describe("repo checks", () => {
  it("runs lint, unit tests, the build, secret scanning, and the requirement check", () => {
    covers("6.6.1");

    const pkg = JSON.parse(readRepo("package.json")) as {
      scripts: Record<string, string>;
    };
    const steps = pkg.scripts.check.split(/\s*&&\s*/);
    for (const step of [
      "pnpm lint",
      "pnpm test",
      "pnpm build",
      "pnpm secrets",
      "pnpm requirements",
    ]) {
      assert.equal(steps.includes(step), true, step);
    }
    assert.equal(pkg.scripts.lint.startsWith("pnpm --filter"), true);
    assert.equal(pkg.scripts.test.includes("pnpm --filter"), true);
    assert.equal(pkg.scripts.build.includes("pnpm --filter"), true);
    assert.equal(pkg.scripts.secrets, "bash scripts/secrets.sh");
    assert.equal(pkg.scripts.requirements, "node scripts/requirements.mjs");
    assert.match(readRepo("scripts/secrets.sh"), /gitleaks/);
  });

  it("invokes pnpm check and pnpm smoke from CI", () => {
    covers("6.6.3", "6.6.4");

    const workflow = parse(readRepo(".github/workflows/ci.yml")) as {
      jobs?: Record<string, { steps?: Array<{ run?: string }> }>;
    };
    const jobs = workflow.jobs ?? {};
    assert.deepEqual(Object.keys(jobs).sort(), ["check", "smoke"]);

    const runs = Object.values(jobs).flatMap((job) =>
      (job.steps ?? []).flatMap((step) => (step.run ? [step.run] : [])),
    );
    assert.equal(
      runs.includes("pnpm check"),
      true,
      "CI must run pnpm check",
    );
    assert.equal(
      runs.includes("pnpm smoke"),
      true,
      "CI must run pnpm smoke",
    );
    const pnpmRuns = runs.filter((run) => run.startsWith("pnpm "));
    for (const run of pnpmRuns) {
      assert.equal(
        run === "pnpm install --frozen-lockfile" ||
          run === "pnpm check" ||
          run === "pnpm smoke",
        true,
        run,
      );
    }
  });
});
