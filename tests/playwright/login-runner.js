const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    page.on('response', async response => {
      try {
        if (response.url().includes('/api/auth/login')) {
          const text = await response.text();
          console.log('XHR', response.status(), response.url(), text.slice(0, 200));
        }
      } catch (e) {
        console.log('response read error', e);
      }
    });

    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    await page.fill('input[name="email"]', 'sample@example.com');
    await page.fill('input[name="password"]', 'Password123');

    await page.click('button[type="submit"]');

    // Wait for the app to persist the auth store in localStorage
    await page.waitForFunction(() => !!localStorage.getItem('authStore'), null, {
      timeout: 10000,
    });

    const stored = await page.evaluate(() => localStorage.getItem('authStore'));
    const parsed = stored ? JSON.parse(stored) : null;
    const token = parsed?.token || null;

    console.log('login token found:', !!token);

    await browser.close();

    if (!token) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
