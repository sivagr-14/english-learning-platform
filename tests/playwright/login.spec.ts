import { test, expect } from '@playwright/test';

test('login with email/password stores tokens and redirects', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  await page.fill('input[name="email"]', 'sample@example.com');
  await page.fill('input[name="password"]', 'Password123');

  await Promise.all([
    page.waitForNavigation({ url: '**/dashboard', timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);

  const token = await page.evaluate(() => {
    const stored = localStorage.getItem('authStore');
    return stored ? JSON.parse(stored).token : null;
  });

  expect(token).toBeTruthy();
});
