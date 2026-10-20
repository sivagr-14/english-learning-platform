import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } }));
    (window as any).spoken = [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class { text: string; constructor(text: string) { this.text = text; } } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ name: "British", lang: "en-GB" }, { name: "American", lang: "en-US" }],
      cancel: () => {}, speak: (utterance: any) => (window as any).spoken.push({ lang: utterance.lang, rate: utterance.rate, voice: utterance.voice?.lang }),
    } });
  });
  await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
  await page.route("**/__control/sync-content", route => route.fulfill({ json: {} }));
});

test("settings survive failed saves, persist across reload and control lesson audio and Tamil", async ({ page }) => {
  let saved = { accent: "en-GB", show_tamil: true, theme: "light" };
  let fail = true;
  await page.route("**/api/vocabulary/learning-preferences", route => {
    if (route.request().method() === "PUT") {
      if (fail) return route.fulfill({ status: 500, json: {} });
      saved = route.request().postDataJSON();
    }
    return route.fulfill({ json: { preferences: saved } });
  });
  await page.route("**/api/vocabulary/knowledge-map?**", route => route.fulfill({ json: { words: [{ id: "00000000-0000-4000-8000-000000000001", word: "adjust", display_label: "adjust", english_meaning: "Change a little.", tamil_meaning: "சரிசெய்" }] } }));
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Save settings" })).toBeEnabled();
  await page.getByLabel("Pronunciation accent").selectOption("en-US");
  await page.getByLabel("Show Tamil meanings").uncheck();
  await page.getByLabel("Appearance").selectOption("dark");
  await page.getByRole("button", { name: "Save settings" }).click();
  // Scope to app content, excluding Next.js's accessibility route announcer.
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not saved");
  await expect(page.getByLabel("Pronunciation accent")).toHaveValue("en-US");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  fail = false;
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Listen slowly", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spoken)).toEqual([{ lang: "en-US", rate: 0.8, voice: "en-US" }]);
  await page.reload();
  await expect(page.getByLabel("Pronunciation accent")).toHaveValue("en-US");
  await expect(page.getByLabel("Show Tamil meanings")).not.toBeChecked();
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "adjust", exact: true })).toBeVisible();
  await expect(page.getByText("சரிசெய்")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("failed preference loading cannot overwrite saved settings with defaults", async ({ page }) => {
  let fail = true;
  let writes = 0;
  await page.route("**/api/vocabulary/learning-preferences", route => {
    if (route.request().method() === "PUT") writes++;
    return fail ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: { preferences: { accent: "en-US", show_tamil: false, theme: "dark" } } });
  });
  await page.goto("/settings");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not load");
  await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "Reload saved settings" }).click();
  await expect(page.getByLabel("Pronunciation accent")).toHaveValue("en-US");
  await expect(page.getByRole("button", { name: "Save settings" })).toBeEnabled();
  expect(writes).toBe(0);
});
