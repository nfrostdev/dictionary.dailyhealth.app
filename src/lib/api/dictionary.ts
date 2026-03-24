import type { DictionaryEntry, DictionaryResult } from '$lib/types/dictionary';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export async function lookupWord(word: string): Promise<DictionaryResult> {
	const trimmed = word.trim().toLowerCase();
	if (!trimmed) {
		return { ok: false, error: 'not-found' };
	}

	try {
		const response = await fetch(`${API_BASE}/${encodeURIComponent(trimmed)}`);

		if (response.status === 404) {
			return { ok: false, error: 'not-found' };
		}

		if (!response.ok) {
			return { ok: false, error: 'network-error' };
		}

		const entries: DictionaryEntry[] = await response.json();
		return { ok: true, entries };
	} catch {
		return { ok: false, error: 'network-error' };
	}
}
