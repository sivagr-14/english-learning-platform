import { expect, test } from "playwright/test";

test("Knowledge Map switches B1–C1 and opens the existing lesson", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("authStore", JSON.stringify({
      token: "fixture-token",
      refreshToken: "fixture-refresh",
      user: { id: "fixture-user", email: "fixture@example.invalid" },
    }));
  });
  await page.route("**/health", (route) => route.fulfill({ json: { revision: "test" } }));
  await page.route("**/api/vocabulary/knowledge-map?**", (route) => {
    const level = new URL(route.request().url()).searchParams.get("level");
    return route.fulfill({ json: {
      levels: [
        { level: "B1", total: 1, learning: 1, mastered: 0 },
        { level: "B2", total: 1, learning: 0, mastered: 1 },
        { level: "C1", total: 0, learning: 0, mastered: 0 },
      ],
      words: level === "C1" ? [] : [{
        id: "00000000-0000-4000-8000-000000000001",
        word: level === "B1" ? "adjust" : "substantiate",
        display_label: level === "B1" ? "adjust" : "substantiate",
        word_type: "verb",
        english_meaning: "Change a little to fit a situation.",
        tamil_meaning: "சரிசெய்",
        frequency: "medium",
        knowledge_status: level === "B1" ? "learning" : "mastered",
      }],
      pagination: { page: 1, limit: 24, total: level === "C1" ? 0 : 1, total_pages: 1 },
    } });
  });

  await page.goto("/knowledge-map");
  await expect(page.getByRole("link", { name: /adjust/ })).toBeVisible();
  await page.getByRole("tab", { name: /B2/ }).click();
  await expect(page.getByRole("link", { name: /substantiate/ })).toBeVisible();
  await expect(page.getByText("சரிசெய்")).toBeVisible();
  await page.getByRole("tab", { name: /C1/ }).click();
  await expect(page.getByText("No assessed C1 entries yet")).toBeVisible();
});


test("starting a new entry queues review and refreshes its status", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("authStore", JSON.stringify({
      token: "fixture-token",
      refreshToken: "fixture-refresh",
      user: { id: "fixture-user", email: "fixture@example.invalid" },
    }));
  });
  await page.route("**/health", (route) => route.fulfill({ json: { revision: "test" } }));
  let started = false;
  await page.route("**/api/vocabulary/knowledge-map/*/start", (route) => {
    started = true;
    return route.fulfill({ json: { status: "learning" } });
  });
  await page.route("**/api/vocabulary/knowledge-map?**", (route) =>
    route.fulfill({ json: {
      levels: [{ level: "B1", total: 1, learning: started ? 1 : 0, mastered: 0 }],
      words: [{
        id: "00000000-0000-4000-8000-000000000001",
        word: "adjust", display_label: "adjust", word_type: "verb",
        english_meaning: "Change a little.", tamil_meaning: "சரிசெய்",
        frequency: "medium", knowledge_status: started ? "learning" : "new",
      }],
      pagination: { page: 1, limit: 24, total: 1, total_pages: 1 },
    } }),
  );
  await page.goto("/knowledge-map");
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.getByRole("link", { name: "Review now" })).toBeVisible();
  expect(started).toBe(true);
});


for (const width of [390, 1280]) {
  test(`purple home, drawer and meaning map journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
    await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
    await page.route("**/api/vocabulary/learning-preferences", route => route.fulfill({ json: { preferences: { accent: "en-GB", show_tamil: true, theme: "light" } } }));
    await page.route("**/api/progress", route => route.fulfill({ json: { summary: { totalEntries: 40, mastered: 4, dueNow: 3, accuracy: 80 } } }));
    await page.route("**/api/vocabulary/knowledge-map?**", route => route.fulfill({ json: {
      levels: [{ level: "B1", total: 40, known: 10, learning: 12, mastered: 4 }],
      words: Array.from({ length: 40 }, (_, i) => ({ id: `entry-${i}`, word: `word${i}`, display_label: `word${i}`, word_type: "noun", english_meaning: `Contextual meaning ${i}`, tamil_meaning: "சரிசெய்", frequency: "medium", knowledge_status: ["new", "learning", "known", "mastered"][i % 4] })),
      pagination: { page: 1, limit: 100, total: 40, total_pages: 1 },
    } }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Today’s Reviews" })).toBeVisible();
    await expect(page.locator(".review-home-card strong")).toHaveText("3");
    const shell = await page.locator(".wordup-shell").boundingBox();
    expect(shell!.width).toBeLessThanOrEqual(700);
    expect(Math.abs(shell!.x - (width - shell!.width) / 2)).toBeLessThan(2);
    await expect(page.locator(".workspace-bar")).toHaveCSS("background-color", "rgb(96, 35, 139)");
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Navigation menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.click();
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Knowledge Map", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator(".knowledge-cell")).toHaveCount(40);
    await page.getByRole("button", { name: "word2: Already known", exact: true }).click();
    await expect(page.getByRole("article", { name: "Selected meaning" }).getByRole("heading")).toHaveText("word2");
    await expect(page.getByRole("button", { name: "word2: Already known", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", "/vocabulary/words/entry-2?from=map");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("article", { name: "Selected meaning" }).getByRole("heading")).toHaveText("word3");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/map-${width}.png`, fullPage: true });
  });
}
