import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	use: {
		baseURL: 'http://localhost:4173',
		...devices['Desktop Chrome']
	},
	retries: 1,
	timeout: 30000
});
