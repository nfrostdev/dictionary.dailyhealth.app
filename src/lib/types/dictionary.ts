export interface DictionaryEntry {
	word: string;
	/** Spelling split into syllables, joined by U+00B7 (e.g. "ag·ri·cul·ture"). */
	syllables?: string;
	/** Sound-it-out respelling; the stressed syllable is uppercase (e.g. "AG-rih-kul-cher"). */
	sayIt?: string;
	meanings: Meaning[];
	license: License;
	sourceUrls: string[];
}

export interface Meaning {
	partOfSpeech: string;
	definitions: Definition[];
	synonyms: string[];
	antonyms: string[];
}

export interface Definition {
	definition: string;
	synonyms: string[];
	antonyms: string[];
	example?: string;
}

export interface License {
	name: string;
	url: string;
}

export type DictionaryResult =
	| { ok: true; entries: DictionaryEntry[] }
	| { ok: false; error: 'not-found' | 'network-error' | 'blocked' };

/** One sense in a static/dict shard: definition and optional example. */
export interface ShardSense {
	d: string;
	x?: string;
}

/** One part of speech in a shard entry. */
export interface ShardMeaning {
	p: string;
	d: ShardSense[];
}

/** A word's record in a shard; `w` is the display form when it isn't the lowercase key. */
export interface ShardEntry {
	w?: string;
	/** Spelling syllables joined by U+00B7. */
	s?: string;
	/** Respelling (American), stressed syllable uppercase. */
	say?: string;
	m: ShardMeaning[];
}

/** Contents of one static/dict/<key>.json file, keyed by lowercase word. */
export type Shard = Record<string, ShardEntry>;
