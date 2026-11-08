import { expect, test, type Page, type Request } from "@playwright/test";

const API = process.env.API_ORIGIN ?? "http://127.0.0.1:3000";
const TOKEN =
  process.env.API_AUTH_TOKEN_MCP ?? "local-dev-api-mcp-token-not-for-nas";

const LIST_ERROR = "Could not load recipes.";
const NO_MATCHES = "No recipes match.";
const UPDATING = "Updating recipes.";

type Facts = {
  primaryProtein?: string | null;
  totalMinutes?: number | null;
  effort?: "low" | "medium" | "high" | null;
  mealTypes?: Array<"breakfast" | "lunch" | "dinner" | "snack" | "dessert">;
};

function stamp(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recipeLink(page: Page, title: string) {
  return page.getByRole("link", { name: new RegExp(escapeRegExp(title)) });
}

function isRecipeListGet(request: Request): boolean {
  if (request.method() !== "GET") {
    return false;
  }
  return new URL(request.url()).pathname === "/api/recipes";
}

async function saveRecipe(
  id: string,
  title: string,
  extras: {
    ingredients?: Array<{ line: string; name?: string }>;
    facts?: Facts;
  } = {},
): Promise<void> {
  const response = await fetch(`${API}/recipes`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id,
      actor: "chef",
      title,
      servings: 2,
      steps: ["Cook."],
      ingredients: extras.ingredients ?? [{ line: "salt", name: "salt" }],
      facts: extras.facts,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `save ${id} failed ${response.status} ${await response.text()}`,
    );
  }
}

async function openFilters(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
}

async function closeFilters(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
}

async function searchTitle(page: Page, value: string): Promise<void> {
  await page.getByLabel("Recipe name").fill(value);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("title"))
    .toBe(value);
}

test.describe("recipe search", () => {
  test("returns focus to Filters after native Escape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
    const filters = page.getByRole("button", { name: /^Filters/ });
    await filters.click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
    await expect(filters).toBeFocused();
  });

  test("filters by name and ingredient without splitting across names", async ({
    page,
  }) => {
    const id = stamp();
    const breast = `Example: PwBreast ${id}`;
    const pan = `Example: PwPan ${id}`;
    const garlicTitle = `Example: PwLemon ${id}`;
    const garlicName = `pw-gar-${id}`;
    await Promise.all([
      saveRecipe(`pw-breast-${id}`, breast),
      saveRecipe(`pw-pan-${id}`, pan, {
        ingredients: [
          { line: "chicken stock", name: "chicken stock" },
          { line: "turkey breast", name: "turkey breast" },
        ],
      }),
      saveRecipe(`pw-garlic-${id}`, garlicTitle, {
        ingredients: [{ line: garlicName, name: garlicName }],
      }),
    ]);

    await page.goto("/");
    await searchTitle(page, `PwBreast ${id}`);
    await expect(recipeLink(page, breast)).toBeVisible();
    await expect(recipeLink(page, pan)).toHaveCount(0);

    await searchTitle(page, `PwLemon ${id}`);
    await expect(recipeLink(page, garlicTitle)).toBeVisible();
    await openFilters(page);
    await page.getByLabel("Add ingredient").fill(garlicName);
    await page.getByRole("button", { name: "Add ingredient" }).click();
    await closeFilters(page);
    await expect(
      page.getByRole("button", { name: `Remove ${garlicName}` }),
    ).toBeVisible();
    await expect(recipeLink(page, garlicTitle)).toBeVisible();
    await expect(recipeLink(page, breast)).toHaveCount(0);
  });

  test("applies category and custom protein, then remove and clear", async ({
    page,
  }) => {
    const id = stamp();
    const prefix = `PwMix ${id}`;
    const seitanProtein = `pw-seitan-${id}`;
    const dinner = `Example: ${prefix} dinner`;
    const lunch = `Example: ${prefix} lunch`;
    await Promise.all([
      saveRecipe(`pw-dinner-${id}`, dinner, {
        facts: {
          primaryProtein: seitanProtein,
          totalMinutes: 20,
          effort: "low",
          mealTypes: ["dinner"],
        },
      }),
      saveRecipe(`pw-lunch-${id}`, lunch, {
        facts: {
          primaryProtein: "chicken",
          totalMinutes: 20,
          effort: "low",
          mealTypes: ["lunch"],
        },
      }),
    ]);

    await page.goto("/");
    await searchTitle(page, prefix);
    await expect(recipeLink(page, dinner)).toBeVisible();
    await expect(recipeLink(page, lunch)).toBeVisible();

    await openFilters(page);
    await page.getByRole("checkbox", { name: "dinner" }).check();
    await closeFilters(page);
    await expect(page.getByRole("button", { name: "Remove dinner" })).toBeVisible();
    await expect(recipeLink(page, dinner)).toBeVisible();
    await expect(recipeLink(page, lunch)).toHaveCount(0);

    await page.getByRole("button", { name: "Remove dinner" }).click();
    await expect(recipeLink(page, lunch)).toBeVisible();

    await openFilters(page);
    await page.getByLabel("Custom protein").fill(seitanProtein);
    await page.getByRole("button", { name: "Add protein" }).click();
    await closeFilters(page);
    await expect(
      page.getByRole("button", { name: `Remove ${seitanProtein}` }),
    ).toBeVisible();
    await expect(recipeLink(page, dinner)).toBeVisible();
    await expect(recipeLink(page, lunch)).toHaveCount(0);

    await page.getByRole("button", { name: "Clear all" }).first().click();
    await expect(page.getByLabel("Recipe name")).toHaveValue("");
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByText(NO_MATCHES)).toHaveCount(0);
    await expect(recipeLink(page, dinner)).toBeVisible();
    await expect(recipeLink(page, lunch)).toBeVisible();
  });

  test("keeps pending updates distinct from a settled no-match", async ({
    page,
  }) => {
    const id = stamp();
    const title = `Example: PwPending ${id}`;
    const noMatch = `zzzz-nomatch-${id}`;
    await saveRecipe(`pw-pending-${id}`, title);

    await page.goto(`/?title=${encodeURIComponent(noMatch)}`);
    await expect(page.getByText(NO_MATCHES)).toBeVisible();

    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/recipes*", async (route) => {
      if (!isRecipeListGet(route.request())) {
        await route.continue();
        return;
      }
      await gate;
      await route.continue();
    });

    await searchTitle(page, `PwPending ${id}`);
    await expect(page.getByText(UPDATING)).toBeVisible();
    await expect(page.getByText(NO_MATCHES)).toHaveCount(0);
    release();
    await expect(recipeLink(page, title)).toBeVisible();
  });

  test("retries an actual list failure without dropping criteria", async ({
    page,
  }) => {
    const id = stamp();
    const title = `Example: PwRetry ${id}`;
    await saveRecipe(`pw-retry-${id}`, title, {
      facts: {
        primaryProtein: null,
        totalMinutes: 15,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });

    await page.goto("/");
    await searchTitle(page, `PwRetry ${id}`);
    await expect(recipeLink(page, title)).toBeVisible();

    let failList = true;
    await page.route("**/api/recipes*", async (route) => {
      if (!isRecipeListGet(route.request())) {
        await route.continue();
        return;
      }
      if (failList) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await openFilters(page);
    await page.getByRole("checkbox", { name: "dinner" }).check();
    await closeFilters(page);

    await expect(page.getByText(LIST_ERROR)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link")).toHaveCount(0);
    await expect(page.getByLabel("Recipe name")).toHaveValue(`PwRetry ${id}`);
    await expect(page.getByRole("button", { name: "Remove dinner" })).toBeVisible();

    failList = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(recipeLink(page, title)).toBeVisible();
    await expect(page.getByLabel("Recipe name")).toHaveValue(`PwRetry ${id}`);
    await expect(page.getByRole("button", { name: "Remove dinner" })).toBeVisible();
  });

  test("restores filtered criteria and scroll after detail Back and history", async ({
    page,
  }) => {
    const id = stamp();
    const prefix = `PwY ${id}`;
    const titles = Array.from({ length: 12 }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return `Example: ${prefix} ${n}`;
    });
    await Promise.all(
      titles.map((title, index) =>
        saveRecipe(`pw-y-${id}-${index + 1}`, title, {
          facts: {
            primaryProtein: null,
            totalMinutes: 10,
            effort: "low",
            mealTypes: [index === 0 ? "dinner" : "lunch"],
          },
        }),
      ),
    );

    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto("/");
    await searchTitle(page, prefix);
    await expect(page.getByRole("link")).toHaveCount(12);
    const targetTitle = titles[9] ?? "";
    const target = recipeLink(page, targetTitle);
    await target.scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(200);
    await target.click();
    await expect(page).toHaveURL(/\/recipes\//);
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("heading", { name: targetTitle })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
    await expect(page.getByLabel("Recipe name")).toHaveValue(prefix);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("title"))
      .toBe(prefix);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(scrolled - 80);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).not.toBe(0);

    await openFilters(page);
    await page.getByRole("checkbox", { name: "dinner" }).check();
    await closeFilters(page);
    await expect(page.getByRole("button", { name: "Remove dinner" })).toBeVisible();
    await expect(recipeLink(page, titles[0] ?? "")).toBeVisible();
    await expect(recipeLink(page, titles[1] ?? "")).toHaveCount(0);

    await page.goBack();
    await expect(page.getByLabel("Recipe name")).toHaveValue(prefix);
    await expect(page.getByRole("button", { name: "Remove dinner" })).toHaveCount(
      0,
    );
    await expect(recipeLink(page, titles[1] ?? "")).toBeVisible();

    await page.goForward();
    await expect(page.getByRole("button", { name: "Remove dinner" })).toBeVisible();
    await expect(recipeLink(page, titles[0] ?? "")).toBeVisible();
    await expect(recipeLink(page, titles[1] ?? "")).toHaveCount(0);
  });

  test("keeps a focused title draft through a live library update", async ({
    page,
  }) => {
    const id = stamp();
    const draft = `draft-${id}`;
    await page.goto("/");
    const title = page.getByLabel("Recipe name");
    await title.click();
    await title.pressSequentially(draft, { delay: 15 });
    await saveRecipe(`pw-live-${id}`, `Example: PwLive ${id}`);
    await expect(async () => {
      await expect(title).toBeFocused();
      await expect(title).toHaveValue(draft);
    }).toPass({ timeout: 4000 });
  });

  test("matches a selected primary protein by the exact normalized value", async ({
    page,
  }) => {
    const id = stamp();
    const fishTitle = `Example: PwFish ${id}`;
    const shellTitle = `Example: PwShell ${id}`;
    await Promise.all([
      saveRecipe(`pw-fish-${id}`, fishTitle, {
        facts: {
          primaryProtein: "fish",
          totalMinutes: 15,
          effort: "low",
          mealTypes: ["dinner"],
        },
      }),
      saveRecipe(`pw-shell-${id}`, shellTitle, {
        facts: {
          primaryProtein: "shellfish",
          totalMinutes: 15,
          effort: "low",
          mealTypes: ["dinner"],
        },
      }),
    ]);

    await page.goto("/");
    await expect(recipeLink(page, fishTitle)).toBeVisible();
    await expect(recipeLink(page, shellTitle)).toBeVisible();
    await openFilters(page);
    await page.getByRole("checkbox", { name: /^fish$/i }).check();
    await closeFilters(page);
    await expect(page.getByRole("button", { name: "Remove fish" })).toBeVisible();
    await expect(recipeLink(page, fishTitle)).toBeVisible();
    await expect(recipeLink(page, shellTitle)).toHaveCount(0);
  });
});
