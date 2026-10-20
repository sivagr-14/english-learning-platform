import { expect, test } from "playwright/test";

test("discovery saves familiarity before advancing and retries failed writes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
  await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
  await page.route("**/__control/sync-content", route => route.fulfill({ json: {} }));
  let choice = "";
  let fail = true;
  await page.route("**/api/vocabulary/words/*/learner-state", route => {
    if (fail) return route.fulfill({ status: 500, json: { message: "Temporary failure" } });
    choice = route.request().postDataJSON().familiarity;
    return route.fulfill({ json: { state: { familiarity: choice, note: "" } } });
  });
  await page.route("**/api/vocabulary/knowledge-map?**", route => {
    expect(new URL(route.request().url()).searchParams.get("status")).toBe("new");
    return route.fulfill({ json: { words: choice ? [] : [{ id: "00000000-0000-4000-8000-000000000001", word: "adjust", display_label: "adjust", word_type: "verb", pronunciation: "/əˈdʒʌst/", english_meaning: "Change a little to fit.", tamil_meaning: "சரிசெய்" }] } });
  });
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "adjust", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Already know it" }).click();
  // Next.js also renders a route-announcer alert outside the app's main region.
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not saved");
  await expect(page.getByText("0 explored this session")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Already know it" }).click();
  await expect(page.getByText("1 explored this session")).toBeVisible();
  await expect(page.getByRole("heading", { name: /explored every available B1/ })).toBeVisible();
  expect(choice).toBe("known");
});
