import { browser } from '$app/environment';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

let current: Theme = $state('system');

if (browser) {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') {
		current = stored;
	}
}

function applyTheme(theme: Theme) {
	if (!browser) return;
	if (theme === 'system') {
		document.documentElement.removeAttribute('data-theme');
		localStorage.removeItem(STORAGE_KEY);
	} else {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem(STORAGE_KEY, theme);
	}
}

export const theme = {
	get current() {
		return current;
	},
	cycle() {
		const order: Theme[] = ['system', 'light', 'dark'];
		const next = order[(order.indexOf(current) + 1) % order.length];
		current = next;
		applyTheme(next);
	}
};
