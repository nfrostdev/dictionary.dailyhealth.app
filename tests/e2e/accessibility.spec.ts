import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
	test('home page has no accessibility violations', async ({ page }) => {
		await page.goto('/');

		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});

	test('search results page has no accessibility violations', async ({ page }) => {
		await page.goto('/');

		await page.locator('#search-input').fill('hello');
		await page.locator('button[type="submit"]').click();
		await expect(page.locator('article')).toBeVisible({ timeout: 10000 });

		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});

	test('error page has no accessibility violations', async ({ page }) => {
		await page.goto('/');

		await page.locator('#search-input').fill('xyznotaword123');
		await page.locator('button[type="submit"]').click();
		await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });

		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});

	test('skip link moves focus to main content', async ({ page }) => {
		await page.goto('/');

		// Tab to skip link
		await page.keyboard.press('Tab');
		const skipLink = page.locator('.skip-link');
		await expect(skipLink).toBeFocused();

		// Activate skip link
		await page.keyboard.press('Enter');

		// Focus should move to main content area
		const mainContent = page.locator('#main-content');
		await expect(mainContent).toBeFocused();
	});

	test('search form is keyboard accessible', async ({ page }) => {
		await page.goto('/');

		// Click on the search input directly and verify it works with keyboard
		const searchInput = page.locator('#search-input');
		await searchInput.focus();
		await expect(searchInput).toBeFocused();

		// Type and submit with Enter
		await page.keyboard.type('hello');
		await page.keyboard.press('Enter');

		// Results should appear
		await expect(page.locator('article')).toBeVisible({ timeout: 10000 });
	});
});
