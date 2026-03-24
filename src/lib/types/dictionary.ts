export interface DictionaryEntry {
	word: string;
	phonetics: Phonetic[];
	meanings: Meaning[];
	license: License;
	sourceUrls: string[];
}

export interface Phonetic {
	text?: string;
	audio?: string;
	sourceUrl?: string;
	license?: License;
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
