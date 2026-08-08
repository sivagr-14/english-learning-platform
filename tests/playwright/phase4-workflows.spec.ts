import { expect, test } from 'playwright/test';

test.describe('Phase 4 provider workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('authStore', JSON.stringify({
        state: { token: 'e2e-token', refreshToken: 'e2e-refresh', user: { id: 'e2e-user', email: 'e2e@example.test' } },
        version: 0,
      }));
    });
  });

  test('shows exactly the two supported workflows and safe prerequisites', async ({ page }) => {
    await page.route('**/api/generation/config-check', route => route.fulfill({ json: {
      enabled: false, primaryConfigured: false, escalationConfigured: false,
      primaryProvider: 'gemini', primaryModel: 'gemini-test', escalationProvider: 'gemini', escalationModel: 'gemini-pro-test',
      defaultWorkflow: 'chatgpt', workflows: [
        { id: 'chatgpt', name: 'ChatGPT content pack', enabled: true, ready: true, prerequisite: null, cost: 'No API charge.', privacy: 'Private inbox.', automation: 'Sync and import.' },
        { id: 'gemini', name: 'Gemini API', enabled: false, ready: false, prerequisite: 'Enable GEMINI_ENABLED.', cost: 'Metered.', privacy: 'Sent to Gemini.', automation: 'Local worker.' },
      ],
    }}));
    await page.route('**/api/generation/jobs', route => route.fulfill({ json: { jobs: [] } }));
    await page.goto('/import');
    const choices = page.getByRole('button', { name: /ChatGPT content pack|Gemini API/ });
    await expect(choices).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Open ChatGPT Imports' })).toBeVisible();
    await page.getByRole('button', { name: /Gemini API/ }).click();
    await expect(page.getByText('Enable GEMINI_ENABLED.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start import' })).toBeDisabled();
  });
});
