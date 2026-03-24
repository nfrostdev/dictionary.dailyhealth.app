import type { DictionaryEntry, DictionaryResult, Phonetic } from '$lib/types/dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

function mergeEntries(entries: DictionaryEntry[]): DictionaryEntry {
	const first = entries[0];
	const seen = new Set<string>();
	const phonetics: Phonetic[] = [];
	for (const entry of entries) {
		for (const p of entry.phonetics) {
			const key = p.text ?? '';
			if (!seen.has(key)) {
				seen.add(key);
				phonetics.push(p);
			}
		}
	}
	return {
		word: first.word,
		phonetics,
		meanings: entries.flatMap((e) => e.meanings),
		license: first.license,
		sourceUrls: [...new Set(entries.flatMap((e) => e.sourceUrls))]
	};
}

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

		return { ok: true, entries: [mergeEntries(entries)] };
	} catch {
		return { ok: false, error: 'network-error' };
	}
}
