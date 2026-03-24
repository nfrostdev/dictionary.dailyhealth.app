import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
	test('cycles through themes: system -> light -> dark', async ({ page }) => {
		await page.goto('/');

		const themeButton = page.locator('button', { hasText: /theme/i });
		await expect(themeButton).toBeVisible();

		// Initially should be system theme
		await expect(themeButton).toContainText('System theme');

		// Click to switch to light
		await themeButton.click();
		await expect(themeButton).toContainText('Light theme');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

		// Click to switch to dark
		await themeButton.click();
		await expect(themeButton).toContainText('Dark theme');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// Click to return to system
		await themeButton.click();
		await expect(themeButton).toContainText('System theme');
		const html = page.locator('html');
		await expect(html).not.toHaveAttribute('data-theme', 'light');
		await expect(html).not.toHaveAttribute('data-theme', 'dark');
	});

	test('persists theme preference across page reload', async ({ page }) => {
		await page.goto('/');

		const themeButton = page.locator('button', { hasText: /theme/i });

		// Switch to dark
		await themeButton.click(); // system -> light
		await themeButton.click(); // light -> dark
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// Reload
		await page.reload();

		// Should still be dark
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		const reloadedButton = page.locator('button', { hasText: /theme/i });
		await expect(reloadedButton).toContainText('Dark theme');
	});
});
