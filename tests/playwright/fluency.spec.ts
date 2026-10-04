import { source as axeSource } from "axe-core";
import { expect, test } from "playwright/test";
import { STARTER_SAMPLES } from "../../packages/backend/src/data/starter-samples";

const sample = STARTER_SAMPLES[0];
const card = {
  id: "00000000-0000-4000-8000-000000000001",
  word: sample.word,
  display_label: sample.word,
  english_meaning: sample.englishMeaning,
  tamil_meaning: sample.tamilMeaning,
  core_idea: sample.coreIdea,
  track_name: "Everyday communication",
  category_name: "Clear explanations",
  word_type: sample.wordType,
  frequency: sample.frequency,
  pronunciation: sample.pronunciation,
  cefr_level: sample.cefrLevel,
  lesson_data: sample.lesson,
  tags: [],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "authStore",
      JSON.stringify({
        token: "fixture-token",
        refreshToken: "fixture-refresh",
        user: { id: "fixture-user", email: "fixture@example.invalid" },
      }),
    ),
  );
  await page.route("**/__control/**", (r) => r.fulfill({ json: {} }));
  await page.route("**/health", (r) =>
    r.fulfill({ json: { revision: "test" } }),
  );
  await page.route("**/api/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    let data: any = {};
    if (path === "/api/progress")
      data = {
        summary: {
          totalEntries: 1284,
          dueNow: 12,
          mastered: 342,
          accuracy: 86,
          learning: 84,
          reviews: 612,
        },
        categories: [],
      };
    if (path.endsWith("/content-packs"))
      data = { manifests: [], ingestErrors: [] };
    if (path.endsWith("/starter-samples"))
      data = { available: 12, loaded: 12, outdated: 0, version: 4 };
    if (path.endsWith("/taxonomy"))
      data = {
        domains: [],
        counts: { domains: 25, usage_groups: 100, specific_categories: 500 },
      };
    if (path.endsWith("/search"))
      data = {
        words: [card],
        pagination: { page: 1, limit: 50, total: 1, total_pages: 1 },
      };
    if (path.endsWith("/profile"))
      data = {
        profile: {
          timezone: "Europe/Warsaw",
          daily_minutes: 20,
          new_per_day: 10,
          focus: "balanced",
        },
      };
    if (path.endsWith("/practice")) data = { cards: [card] };
    if (path.endsWith("/summary")) data = { skills: [], attempts: [] };
    if (path.endsWith("/attempts")) data = { state: { stage: "recognised" } };
    if (path.endsWith("/collections")) data = { collections: [] };
    if (path.endsWith("/coverage"))
      data = {
        totalEntries: 1,
        categories: [
          {
            key: "work.updates.progress",
            name: "Progress updates",
            domain: "work",
            entries: 1,
            currentFormat: 1,
            levels: { B2: 1 },
          },
          {
            key: "work.strategy.tradeoffs",
            name: "Trade-offs",
            domain: "work",
            entries: 0,
            currentFormat: 0,
            levels: {},
          },
        ],
        notice: "Current format is not a quality audit.",
      };
    if (path.endsWith("/audit"))
      data = { items: [{ id: card.id, passed: true }], next: null };
    if (path === `/api/vocabulary/words/${card.id}`)
      data = {
        word: card,
        navigation: null,
        otherMeanings: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            display_label: `${card.word} (B)`,
            english_meaning: "Another contextual meaning",
          },
        ],
      };
    if (path.endsWith("/categories")) data = { categories: [] };
    await r.fulfill({
      json: data,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      },
    });
  });
});

test("requires a response and self-review before saving production practice", async ({
  page,
}) => {
  await page.goto("/practice");
  await page
    .getByRole("combobox", { name: "Skill", exact: true })
    .selectOption("writing");
  await expect(
    page.getByRole("button", { name: "Compare with the lesson" }),
  ).toBeDisabled();
  await page
    .getByLabel("Your response", { exact: true })
    .fill("My own meaningful sentence for this situation.");
  await page.getByRole("button", { name: "Compare with the lesson" }).click();
  await expect(
    page.getByRole("button", { name: "I could do this" }),
  ).toBeDisabled();
  for (const label of [
    "I used or understood the correct meaning.",
    "My wording fits the pattern and collocations.",
    "The wording suits this situation and tone.",
  ])
    await page.getByLabel(label, { exact: true }).check();
  const requestPromise = page.waitForRequest(
    (r) => r.url().endsWith("/api/fluency/attempts") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "I could do this" }).click();
  const sent = (await requestPromise).postDataJSON();
  expect(sent.skill).toBe("writing");
  expect(sent.word_id).toBe(card.id);
  await expect(
    page.getByRole("heading", { name: "Session finished" }),
  ).toBeVisible();
});
test("coverage includes empty categories and does not call a contract audit semantic review", async ({
  page,
}) => {
  await page.goto("/coverage");
  await page.getByLabel("Empty categories only").check();
  await expect(
    page.getByRole("link", { name: "Trade-offs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Progress updates", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Run contract audit" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Language review remains separate",
  );
});
test("quick lesson retains detailed sections and links distinct meanings", async ({
  page,
}) => {
  await page.goto(`/vocabulary/words/${card.id}`);
  await expect(
    page.getByRole("heading", { name: "Understand it quickly" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Another contextual meaning/ }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Explore the complete lesson" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Advanced Nuance", exact: true }),
  ).toBeVisible();
});

test("mobile navigation is keyboard accessible and closes on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeHidden();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeHidden();
  await toggle.click();
  await page
    .getByRole("link", { name: "Fluency Practice", exact: true })
    .click();
  await expect(page).toHaveURL(/practice/);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeHidden();
});

test("dashboard retry distinguishes unavailable data and professional path opens correctly", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/progress", (r) =>
    r.fulfill(
      fail
        ? { status: 503, json: {} }
        : {
            json: {
              summary: {
                totalEntries: 24,
                dueNow: 2,
                mastered: 8,
                accuracy: 90,
              },
              categories: [],
            },
          },
    ),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "Your learning summary" }),
  ).toContainText("couldn’t load");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "2 opportunities to remember." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Communicate at work/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Path", exact: true }),
  ).toHaveValue("professional");
});

test("skip link and all eight lesson anchors work without a pointer", async ({
  page,
}) => {
  await page.goto(`/vocabulary/words/${card.id}`);
  await expect(
    page.getByRole("heading", { name: "Understand it quickly" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page
    .locator("summary")
    .filter({ hasText: "Explore the complete lesson" })
    .click();
  const nav = page.getByRole("navigation", { name: "Lesson sections" });
  await expect(nav.getByRole("link")).toHaveCount(8);
  await nav.getByRole("link", { name: "8. Advanced Nuance" }).click();
  await expect(page.locator("#lesson-section-8")).toBeFocused();
});

for (const width of [390, 1440]) {
  test(`screen accessibility and overflow at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of [
      "/dashboard",
      "/vocabulary",
      "/categories",
      "/search?q=clear",
      "/practice",
      "/flashcards",
      "/progress",
      "/coverage",
      "/generate",
      `/vocabulary/words/${card.id}`,
      "/login",
      "/register",
      "/login/magic-link",
      "/login/magic-link/verify",
    ]) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page).toHaveTitle("Mastery Skills");
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      if (route === "/login/magic-link/verify")
        await expect(
          page.getByRole("heading", { name: "Sign-in link", exact: true }),
        ).toBeVisible();
      // Wait for the fixture-backed content, rather than inspect a loading shell.
      if (route === "/dashboard")
        await expect(page.getByText("1,284", { exact: true })).toBeVisible();
      if (route.startsWith("/vocabulary/words/")) {
        await expect(
          page.getByRole("heading", { name: "Understand it quickly" }),
        ).toBeVisible();
        await page
          .locator("summary")
          .filter({ hasText: "Explore the complete lesson" })
          .click();
      }
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () =>
        (
          await (window as any).axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          })
        ).violations.map((v: any) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n: any) => n.target),
        })),
      );
      expect(violations, route).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Overflow: ${route}`,
      ).toBe(true);
      if (
        ["/dashboard", `/vocabulary/words/${card.id}`, "/login"].includes(route)
      )
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.split("/").filter(Boolean).join("-")}-${width}.png`,
          ),
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
  });
}

test("live search preserves pattern selection in lesson navigation and cancels stale results", async ({
  page,
}) => {
  let slowStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    slowStarted = resolve;
  });
  let releaseSlow: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  await page.route("**/api/vocabulary/search?**", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q");
    if (q === "slow") {
      slowStarted();
      await gate;
    }
    await route.fulfill({
      json: {
        words: [{ ...card, word: q, display_label: q }],
        pagination: { page: 1, limit: 50, total: 1, total_pages: 1 },
      },
    });
  });
  await page.goto("/search");
  const field = page.getByRole("searchbox", { name: "Search vocabulary" });
  await field.fill("slow");
  await started;
  await field.fill("road");
  await expect(page.getByRole("link", { name: /road/ }).first()).toBeVisible();
  releaseSlow();
  await expect(page.getByRole("link", { name: /^slow/ })).toHaveCount(0);
  await page.getByLabel("Match", { exact: true }).selectOption("suffix");
  await expect(page).toHaveURL(/match=suffix/);
  const result = page.getByRole("link", { name: /road/ }).first();
  await expect(result).toHaveAttribute("href", /match=suffix/);
  await result.click();
  await expect(
    page.getByRole("link", { name: /Back to search/ }),
  ).toHaveAttribute("href", /match=suffix/);
});

test("collection request carries the selected target and blocks invalid numbers", async ({
  page,
}) => {
  let sent: any;
  await page.route("**/api/fluency/collection-request", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { requestId: "pilot-request", policy: sent } });
  });
  await page.goto("/coverage");
  const target = page.getByRole("spinbutton", { name: /Target senses/ });
  await expect(target).toHaveValue("80000");
  await expect(page.getByText(/approximately 200 visible packs/)).toBeVisible();
  await target.fill("400");
  await page
    .getByRole("button", { name: "Prepare collection request for ChatGPT" })
    .click();
  await expect.poll(() => sent?.targetSenses).toBe(400);
  await target.fill("399");
  await expect(
    page.getByRole("button", {
      name: "Prepare collection request for ChatGPT",
    }),
  ).toBeDisabled();
});
