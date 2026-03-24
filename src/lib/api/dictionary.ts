import type { DictionaryEntry, DictionaryResult } from '$lib/types/dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export async function lookupWord(word: string): Promise<DictionaryResult> {
	const trimmed = word.trim().toLowerCase();
	if (!trimmed || isBlockedWord(trimmed)) {
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

		const raw: DictionaryEntry[] = await response.json();
		const entries = raw.map(filterEntry).filter((e): e is DictionaryEntry => e !== null);

		if (entries.length === 0) {
			return { ok: false, error: 'not-found' };
		}

		return { ok: true, entries };
	} catch {
		return { ok: false, error: 'network-error' };
	}
}
