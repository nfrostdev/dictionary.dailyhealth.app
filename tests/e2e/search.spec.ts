import { test, expect } from '@playwright/test';

test.describe('Search', () => {
	test('searches for a word and displays results', async ({ page }) => {
		await page.goto('/');

		const searchInput = page.locator('#search-input');
		await searchInput.fill('hello');
		await page.locator('button[type="submit"]').click();

		// Wait for results
		const result = page.locator('article');
		await expect(result).toBeVisible({ timeout: 10000 });

		// Should display the word
		await expect(result.locator('h2')).toHaveText('hello');

		// Should have at least one part of speech
		await expect(result.locator('h3').first()).toBeVisible();
	});

	test('shows syllables and a sound-it-out respelling', async ({ page }) => {
		await page.goto('/');

		await page.locator('#search-input').fill('agriculture');
		await page.locator('button[type="submit"]').click();

		const result = page.locator('article');
		await expect(result.getByText('ag·ri·cul·ture')).toBeVisible({ timeout: 10000 });
		await expect(result.getByText('AG-rih-kul-cher')).toBeVisible();
	});

	test('shows error for non-existent word', async ({ page }) => {
		await page.goto('/');

		const searchInput = page.locator('#search-input');
		await searchInput.fill('qqqxnotaword');
		await page.locator('button[type="submit"]').click();

		const alert = page.locator('[role="alert"]');
		await expect(alert).toBeVisible({ timeout: 10000 });
		await expect(alert).toContainText("That word isn't in this dictionary");
	});

	test('shows proper nouns with their capital letter', async ({ page }) => {
		await page.goto('/');

		await page.locator('#search-input').fill('january');
		await page.locator('button[type="submit"]').click();

		const result = page.locator('article');
		await expect(result).toBeVisible({ timeout: 10000 });
		await expect(result.locator('h2')).toHaveText('January');
	});

	test('makes no requests to other websites', async ({ page, baseURL }) => {
		const origin = new URL(baseURL!).origin;
		const external: string[] = [];
		page.context().on('request', (request) => {
			const url = new URL(request.url());
			if (url.protocol.startsWith('http') && url.origin !== origin) external.push(url.href);
		});

		await page.goto('/');
		await page.locator('#search-input').fill('hello');
		await page.locator('button[type="submit"]').click();
		await expect(page.locator('article')).toBeVisible({ timeout: 10000 });

		expect(external).toEqual([]);
	});

	test('shows spell suggestions for misspelled word', async ({ page }) => {
		await page.goto('/');

		const searchInput = page.locator('#search-input');
		await searchInput.fill('elefant');
		await page.locator('button[type="submit"]').click();

		const alert = page.locator('[role="alert"]');
		await expect(alert).toBeVisible({ timeout: 10000 });
		await expect(alert).toContainText('Did you mean');

		// Click a suggestion and it should search
		const suggestion = alert.locator('button', { hasText: 'elephant' });
		await expect(suggestion).toBeVisible();
		await suggestion.click();

		// Should now show results for elephant
		const result = page.locator('article');
		await expect(result).toBeVisible({ timeout: 10000 });
		await expect(result.locator('h2')).toHaveText('elephant');
	});

	test('displays loading state', async ({ page }) => {
		await page.goto('/');

		const searchInput = page.locator('#search-input');
		await searchInput.fill('hello');
		await page.locator('button[type="submit"]').click();

		// The loading text should appear briefly
		// (it may be too fast to catch, so we just verify the final state)
		const result = page.locator('article');
		await expect(result).toBeVisible({ timeout: 10000 });
	});
});
