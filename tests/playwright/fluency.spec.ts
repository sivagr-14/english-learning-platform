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
  await page.getByRole("combobox", { name: "Skill", exact: true }).selectOption("writing");
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
  await page.locator("summary").filter({ hasText: "Explore the complete lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Advanced Nuance", exact: true }),
  ).toBeVisible();
});
