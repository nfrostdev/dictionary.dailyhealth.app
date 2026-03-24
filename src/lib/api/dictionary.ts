import type {
	Definition,
	DictionaryEntry,
	DictionaryResult,
	Meaning,
	Phonetic
} from '$lib/types/dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

function mergeMeanings(meanings: Meaning[]): Meaning[] {
	const groups = new Map<string, Definition[][]>();
	const first = new Map<string, Meaning>();
	for (const m of meanings) {
		const existing = groups.get(m.partOfSpeech);
		if (existing) {
			existing.push(m.definitions);
		} else {
			groups.set(m.partOfSpeech, [m.definitions]);
			first.set(m.partOfSpeech, m);
		}
	}
	return [...groups.entries()].map(([pos, defArrays]) => ({
		...first.get(pos)!,
		definitions: interleave(defArrays)
	}));
}

function interleave<T>(arrays: T[][]): T[] {
	if (arrays.length === 0) return [];
	const result: T[] = [];
	const maxLen = Math.max(...arrays.map((a) => a.length));
	for (let i = 0; i < maxLen; i++) {
		for (const arr of arrays) {
			if (i < arr.length) result.push(arr[i]);
		}
	}
	return result;
}

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
		meanings: mergeMeanings(entries.flatMap((e) => e.meanings)),
		license: first.license,
		sourceUrls: [...new Set(entries.flatMap((e) => e.sourceUrls))]
	};
}

export async function lookupWord(word: string): Promise<DictionaryResult> {
	const trimmed = word.trim().toLowerCase();
	if (!trimmed) {
		return { ok: false, error: 'not-found' };
	}
	if (isBlockedWord(trimmed)) {
		return { ok: false, error: 'blocked' };
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
			return { ok: false, error: 'blocked' };
		}

		return { ok: true, entries: [mergeEntries(entries)] };
	} catch {
		return { ok: false, error: 'network-error' };
	}
}
