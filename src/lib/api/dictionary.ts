import type { DictionaryEntry, DictionaryResult, Shard, ShardEntry } from '$lib/types/dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';
import { shardKey } from './shard-key';

const LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

export function toEntry(key: string, raw: ShardEntry): DictionaryEntry {
	const word = raw.w ?? key;
	return {
		word,
		...(raw.s ? { syllables: raw.s } : {}),
		...(raw.say ? { sayIt: raw.say } : {}),
		meanings: raw.m.map((m) => ({
			partOfSpeech: m.p,
			definitions: m.d.map((s) => ({
				definition: s.d,
				...(s.x ? { example: s.x } : {}),
				synonyms: [],
				antonyms: []
			})),
			synonyms: [],
			antonyms: []
		})),
		license: LICENSE,
		sourceUrls: [`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`]
	};
}

export async function lookupWord(word: string): Promise<DictionaryResult> {
	// Phone keyboards type curly apostrophes; shard keys use straight ones
	const trimmed = word.trim().toLowerCase().replace(/[‘’]/g, "'");
	if (!trimmed) {
		return { ok: false, error: 'not-found' };
	}
	if (isBlockedWord(trimmed)) {
		return { ok: false, error: 'blocked' };
	}

	try {
		const response = await fetch(`/dict/${shardKey(trimmed)}.json`);

		// No shard file means no word in the dictionary starts with these letters
		if (response.status === 404) {
			return { ok: false, error: 'not-found' };
		}

		if (!response.ok) {
			return { ok: false, error: 'network-error' };
		}

		const shard: Shard = await response.json();
		if (!Object.hasOwn(shard, trimmed)) {
			return { ok: false, error: 'not-found' };
		}

		const entry = filterEntry(toEntry(trimmed, shard[trimmed]));
		if (!entry) {
			return { ok: false, error: 'blocked' };
		}

		return { ok: true, entries: [entry] };
	} catch {
		return { ok: false, error: 'network-error' };
	}
}
