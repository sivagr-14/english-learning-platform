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
