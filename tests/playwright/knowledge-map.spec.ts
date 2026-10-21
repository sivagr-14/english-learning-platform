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
    const mapTile = await page.locator(".map-art i").first().boundingBox();
    expect(mapTile!.height).toBeGreaterThan(10);
    const brand = await page.locator(".workspace-label").boundingBox();
    expect(brand!.height).toBeLessThan(32);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true, animations: "disabled" });
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
    const cardBounds = await page.locator(".map-word-card").boundingBox();
    const gridBounds = await page.locator(".knowledge-grid").boundingBox();
    const filtersBounds = await page.locator(".map-filters").boundingBox();
    expect(cardBounds!.y).toBeLessThan(250);
    expect(gridBounds!.y).toBeLessThan(850);
    expect(filtersBounds!.y).toBeGreaterThan(gridBounds!.y);
    const levelBounds = await page.getByRole("tab", { name: /B1/ }).boundingBox();
    expect(levelBounds!.height).toBeLessThan(60);
    await expect(page.locator(".map-word-card .discovery-phonetic")).not.toHaveText(/^\s*·/);

    await page.getByRole("button", { name: "word2: Already known", exact: true }).click();
    await expect(page.getByRole("article", { name: "Selected meaning" }).getByRole("heading")).toHaveText("word2");
    await expect(page.getByRole("button", { name: "word2: Already known", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", /\/vocabulary\/words\/entry-2\?from=map&map=/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("article", { name: "Selected meaning" }).getByRole("heading")).toHaveText("word3");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: `test-results/map-${width}.png`, fullPage: true, animations: "disabled" });
  });
}

for (const width of [390, 1280]) {
test(`collections, progress and guided practice retain their contracts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
  await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
  await page.route("**/api/vocabulary/learning-preferences", route => route.fulfill({ json: { preferences: { accent: "en-GB", show_tamil: true, theme: "dark" } } }));
  let createdList = false;
  await page.route("**/api/vocabulary/categories", route => route.fulfill({ json: { categories: [
    { id: "favourite", category_name: "Favourite", track_name: "My words", word_count: "5", is_user_category: true, is_default: true },
    ...(createdList ? [{ id: "travel", category_name: "Travel phrases", track_name: "My words", word_count: "0", is_user_category: true, is_default: false }] : []),
  ] } }));
  await page.route("**/api/vocabulary/taxonomy", route => route.fulfill({ json: { counts: { domains: 1, usage_groups: 1, specific_categories: 1 }, domains: [{ key: "work", name: "Work", word_count: 4, usage_groups: [{ key: "meetings", name: "Meetings", word_count: 4, categories: [{ key: "requests", name: "Requests", word_count: 4, description: "Making requests" }] }] }] } }));
  let failCreate = true;
  await page.route("**/api/vocabulary/user-categories", route => {
    expect(route.request().postDataJSON()).toEqual({ name: "Travel phrases", description: "For my next trip" });
    if (failCreate) return route.fulfill({ status: 500, json: {} });
    createdList = true;
    return route.fulfill({ json: { category: { id: "travel", category_name: "Travel phrases" } } });
  });
  await page.goto("/categories");
  await expect(page.getByRole("link", { name: /Favourite/ })).toHaveAttribute("href", "/categories/favourite");
  await page.getByRole("button", { name: "Explore topics", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Learning taxonomy" })).toBeVisible();
  await page.locator("summary").filter({ hasText: /^Work/ }).click();
  await expect(page.getByRole("link", { name: "Requests · 4" })).toHaveAttribute("href", "/taxonomy/requests");
  await page.getByRole("button", { name: "My lists", exact: true }).click();
  await expect(page.getByRole("link", { name: /Favourite/ })).toBeVisible();
  await page.screenshot({ path: `test-results/collections-${width}.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Create category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Travel phrases");
  await page.getByLabel("Description (optional)", { exact: true }).fill("For my next trip");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Category name", { exact: true })).toHaveValue("Travel phrases");
  failCreate = false;
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Travel phrases was created and is ready for words.", { exact: true })).toBeVisible();
  expect(createdList).toBe(true);
  await expect(page.getByRole("link", { name: /Travel phrases/ })).toHaveAttribute("href", "/categories/travel");
  await page.reload();
  await expect(page.getByRole("link", { name: /Travel phrases/ })).toHaveAttribute("href", "/categories/travel");

  await page.route("**/api/progress", route => route.fulfill({ json: { summary: { totalEntries: 10, learning: 5, mastered: 2, dueNow: 3, reviews: 12, accuracy: 80 }, categories: [{ id: "favourite", category_name: "Favourite", track_name: "My words", total: 10, mastered: 2 }] } }));
  await page.goto("/progress");
  await expect(page.getByRole("progressbar", { name: "Favourite recall established" })).toHaveAttribute("aria-valuenow", "20");
  await expect(page.getByRole("link", { name: "Review due words" })).toHaveAttribute("href", "/flashcards");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/progress-${width}.png`, fullPage: true, animations: "disabled" });
  await page.route("**/api/fluency/profile", route => route.fulfill({ json: { profile: { timezone: "Europe/Warsaw", daily_minutes: 20, new_per_day: 10, focus: "balanced" } } }));
  await page.route("**/api/fluency/summary", route => route.fulfill({ json: { skills: [], attempts: [] } }));
  const requestedSkills: string[] = [];
  await page.route("**/api/fluency/practice?**", route => { requestedSkills.push(new URL(route.request().url()).searchParams.get("skill")!); return route.fulfill({ json: { cards: [] } }); });
  await page.goto("/practice?skill=writing");
  await expect(page.getByRole("button", { name: "Write", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => requestedSkills.includes("writing")).toBe(true);
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect.poll(() => requestedSkills.includes("recognition")).toBe(true);
  await expect(page.getByRole("link", { name: "Open ChatGPT" })).toHaveAttribute("href", "https://chatgpt.com/");
  await page.getByText("Preview or select the prompt", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "ChatGPT practice prompt" })).toHaveValue(/Help me practise English/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: `test-results/practice-${width}-dark.png`, fullPage: true, animations: "disabled" });
});
}

test("review preserves a failed rating for retry and obeys Tamil visibility", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
  await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
  await page.route("**/api/vocabulary/learning-preferences", route => route.fulfill({ json: { preferences: { accent: "en-GB", show_tamil: false, theme: "light" } } }));
  await page.route("**/api/flashcards/categories", route => route.fulfill({ json: { categories: [{ id: "daily", category_name: "Daily life", track_name: "Conversation", difficulty_level: "B1", due_count: 1 }] } }));
  await page.route("**/api/flashcards/due?**", route => route.fulfill({ json: { cards: [{ id: "word-1", word: "adjust", display_label: "adjust", english_meaning: "Change a little", tamil_meaning: "சரிசெய்", category_name: "Daily life", cefr_level: "B1", frequency: "medium" }] } }));
  let fail = true;
  const attempts: { rating: string; requestId: string }[] = [];
  await page.route("**/api/flashcards/word-1/review", route => { attempts.push(route.request().postDataJSON()); return route.fulfill({ status: fail ? 500 : 200, json: {} }); });
  await page.goto("/flashcards");
  await page.getByRole("button", { name: /Daily life/ }).click();
  await expect(page.getByText("சரிசெய்")).toBeHidden();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.getByRole("heading", { name: "adjust", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Listen", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recall", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Natural Use", exact: true })).toHaveCount(0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/review-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not save this review");
  await expect(page.getByRole("heading", { name: "adjust", exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No cards due in this category" })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});

for (const width of [390, 1280]) {
  test(`map returns to the selected meaning after a complete lesson, note and favourite journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
    await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
    await page.route("**/api/vocabulary/learning-preferences", route => route.fulfill({ json: { preferences: { accent: "en-GB", show_tamil: true, theme: width === 390 ? "dark" : "light" } } }));
    const lesson = {
      format_version: "simplified-v2",
      overview: { meaning_usage_profile: { meaning_type: "literal", connotation: "neutral", tone: "neutral", register: "neutral" } },
      meaning_in_context: { source_sentence: "We adjusted the plan.", contextual_meaning: "Changed the plan slightly.", simple_explanation: "Make a small change so it works better." },
      usage_guide: { when_to_use: ["For a small change."], when_not_to_use: ["For replacing the whole thing."] },
      patterns_collocations: { main_pattern: "adjust + noun", common_collocations: ["adjust a plan"] },
      natural_examples: { examples: { work: "We adjusted the plan." }, mini_conversation: "A: Is the plan ready? B: I need to adjust it." },
      mistakes_differences: { common_mistake: "adjust to the volume", correction: "adjust the volume", important_difference: "Adjust something changes it; adjust to something means adapt." },
      memory_practice: { memory_trigger: "A small turn of a dial.", memory_sentence: "Adjust the volume.", recall_question: "What means change slightly?", recognition_task: "Find the small change.", production_task: "Describe a plan you changed." },
      advanced_nuance: ["Adjust can refer to physical or abstract changes."],
    };
    const word = { id: "meaning-2", word: "adjust", display_label: "adjust (change)", word_type: "verb", cefr_level: "B2", english_meaning: "Make a small change.", tamil_meaning: "சரிசெய்", core_idea: "A small change for a better fit.", frequency: "medium", knowledge_status: "learning", track_name: "Daily life", category_name: "Plans", lesson_data: lesson };
    await page.route("**/api/vocabulary/knowledge-map?**", route => route.fulfill({ json: { levels: [{ level: "B2", total: 102, learning: 2, mastered: 0 }], words: new URL(route.request().url()).searchParams.get("status") === "new" ? [word] : [{ ...word, id: "meaning-1", word: "adapt", display_label: "adapt" }, word], pagination: { page: 2, limit: 100, total: 102, total_pages: 2 } } }));
    await page.route("**/api/vocabulary/words/meaning-2", route => {
      // Keep UI-only from=map/from=discover away from the API's strict enum.
      expect(new URL(route.request().url()).search).toBe("");
      return route.fulfill({ json: { word } });
    });
    let note = "";
    let failNote = true;
    await page.route("**/api/vocabulary/words/meaning-2/learner-state", route => {
      if (route.request().method() === "PUT") {
        if (failNote) return route.fulfill({ status: 500, json: {} });
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({ note: "Think of the volume dial." });
        note = payload.note;
      }
      return route.fulfill({ json: { state: { note, familiarity: "learning" } } });
    });
    let added = false;
    await page.route("**/api/vocabulary/categories?includeEmpty=true", route => route.fulfill({ json: { categories: [{ id: "favourite", category_name: "Favourite", is_user_category: true, is_default: true, word_count: added ? 1 : 0 }] } }));
    await page.route("**/api/vocabulary/words/categories", route => {
      expect(route.request().postDataJSON()).toEqual({ wordIds: ["meaning-2"], categoryId: "favourite" });
      added = true;
      return route.fulfill({ json: { added: 1, already_present: 0, category: { id: "favourite", category_name: "Favourite" } } });
    });
    await page.goto("/knowledge-map?level=B2&q=adjust&status=learning&page=2&selected=meaning-2");
    await expect(page.getByRole("tab", { name: /B2/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("searchbox", { name: "Find a word" })).toHaveValue("adjust");
    await page.getByRole("link", { name: "Open lesson" }).click();
    await expect(page.getByRole("heading", { name: "adjust (change)", level: 1 })).toBeVisible();
    await page.getByText("Explore the complete lesson", { exact: true }).click();
    const titles = ["Overview", "Meaning in Context", "Usage Guide", "Patterns & Collocations", "Natural Examples", "Mistakes & Differences", "Memory & Practice", "Advanced Nuance"];
    await expect(page.locator('[id^="lesson-section-"]')).toHaveCount(8);
    for (const title of titles) await expect(page.getByRole("heading", { name: title, exact: true, level: 3 })).toBeVisible();
    await page.getByRole("navigation", { name: "Lesson sections" }).getByRole("link", { name: "8. Advanced Nuance", exact: true }).click();
    await expect(page.locator("#lesson-section-8")).toBeFocused();
    await expect(page.locator("#lesson-section-1 [lang=ta]")).toHaveText("சரிசெய்");
    await page.getByLabel("My note or memory cue").fill("Think of the volume dial.");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Your edits are still here");
    await expect(page.getByLabel("My note or memory cue")).toHaveValue("Think of the volume dial.");
    failNote = false;
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(page.getByText("Note saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add 1 word", exact: true }).click();
    await expect(page.getByText("1 word added to Favourite.", { exact: true })).toBeVisible();
    expect(added).toBe(true);
    await page.reload();
    await expect(page.getByLabel("My note or memory cue")).toHaveValue("Think of the volume dial.");
    await expect(page.getByRole("button", { name: "Want to learn", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByText("Explore the complete lesson", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `test-results/lesson-${width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("link", { name: "Back to Knowledge Map", exact: true }).click();
    await expect(page.getByRole("tab", { name: /B2/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("searchbox", { name: "Find a word" })).toHaveValue("adjust");
    await expect(page.getByRole("combobox", { name: "Show", exact: true })).toHaveValue("learning");
    await expect(page.getByRole("button", { name: "adjust (change): Learning", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Page 2 of 2 · 102 words")).toBeVisible();
    await page.goto("/discover?level=B2");
    await expect(page.getByLabel("Your level", { exact: true })).toHaveValue("B2");
    await expect(page.getByRole("heading", { name: "adjust (change)", exact: true })).toBeVisible();
    const lessonContrast = await page.locator(".discovery-lesson").evaluate(link => {
      const luminance = (color: string) => {
        const channels = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(getComputedStyle(link).color);
      const background = luminance(getComputedStyle(link.closest("article")!).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(lessonContrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `test-results/discover-${width}.png`, fullPage: true, animations: "disabled" });
    await expect(page.getByRole("link", { name: "Explore all eight lesson sections" })).toHaveAttribute("href", "/vocabulary/words/meaning-2?from=discover&level=B2");
    await page.getByRole("link", { name: "Explore all eight lesson sections" }).click();
    await expect(page).toHaveURL(/\/vocabulary\/words\/meaning-2\?from=discover&level=B2$/);
    await expect(page.getByRole("heading", { name: "adjust (change)", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Back to Discover", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discover your next word" })).toBeVisible();
    await expect(page.getByLabel("Your level", { exact: true })).toHaveValue("B2");
    await page.reload();
    await expect(page.getByLabel("Your level", { exact: true })).toHaveValue("B2");
    await page.goto("/discover?level=invalid");
    await expect(page.getByLabel("Your level", { exact: true })).toHaveValue("B1");
  });
}

for (const width of [390, 1280]) {
  test(`guided writing preserves retry identity and distinguishes saved progress from refresh failure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem("authStore", JSON.stringify({ token: "fixture-token", refreshToken: "fixture-refresh", user: { id: "fixture-user", email: "fixture@example.invalid" } })));
    await page.route("**/health", route => route.fulfill({ json: { revision: "test" } }));
    await page.route("**/api/vocabulary/learning-preferences", route => route.fulfill({ json: { preferences: { accent: "en-GB", show_tamil: false, theme: "dark" } } }));
    await page.route("**/api/fluency/profile", route => route.fulfill({ json: { profile: { timezone: "Europe/Warsaw", daily_minutes: 20, new_per_day: 10, focus: "balanced" } } }));
    let saved = false;
    await page.route("**/api/fluency/summary", route => route.fulfill(saved ? { status: 500, json: {} } : { json: { skills: [], attempts: [] } }));
    await page.route("**/api/fluency/practice?**", route => route.fulfill({ json: { cards: [{ id: "practice-1", word: "adjust", display_label: "adjust (change)", english_meaning: "Make a small change.", tamil_meaning: "சரிசெய்", cefr_level: "B2", lesson_data: { memory_practice: { production_task: "Describe a plan you changed.", memory_sentence: "I adjusted the plan." }, natural_examples: { mini_conversation: "A: Is it ready? B: I adjusted the plan." }, patterns_collocations: { main_pattern: "adjust + noun" }, mistakes_differences: { important_difference: "Use it for a small change." } } }] } }));
    const attempts: Record<string, unknown>[] = [];
    await page.route("**/api/fluency/attempts", route => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1) return route.fulfill({ status: 500, json: {} });
      saved = true;
      return route.fulfill({ json: { state: { stage: "learning" } } });
    });
    await page.goto("/practice?skill=writing");
    await page.getByLabel("Your response", { exact: true }).fill("I adjusted the meeting time.");
    const compareButton = page.getByRole("button", { name: "Compare with the lesson", exact: true });
    await expect(compareButton).toHaveCSS("background-color", "rgb(126, 50, 174)");
    await expect(compareButton).toHaveCSS("color", "rgb(255, 255, 255)");
    await compareButton.click();
    await expect(page.getByText("சரிசெய்", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "I could do this", exact: true })).toBeDisabled();
    for (const label of ["I used or understood the correct meaning.", "My wording fits the pattern and collocations.", "The wording suits this situation and tone."]) await page.getByLabel(label, { exact: true }).check();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: `test-results/practice-response-${width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "I could do this", exact: true }).click();
    await expect(page.getByText("Could not confirm the save. Retry; the same response identity prevents duplicate progress.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Your response", { exact: true })).toHaveValue("I adjusted the meeting time.");
    await page.getByRole("button", { name: "I could do this", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Session finished", exact: true })).toBeVisible();
    await expect(page.getByText("Practice saved. The progress summary could not refresh; reload to see the latest totals.", { exact: true })).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[1]).toMatchObject({ word_id: "practice-1", skill: "writing", successful: true, answer: "I adjusted the meeting time." });
  });
}
