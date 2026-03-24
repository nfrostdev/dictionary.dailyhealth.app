import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupWord } from './dictionary';

const mockEntry = {
	word: 'hello',
	phonetics: [{ text: '/həˈloʊ/', audio: 'https://example.com/hello.mp3' }],
	meanings: [
		{
			partOfSpeech: 'noun',
			definitions: [
				{
					definition: 'A greeting',
					synonyms: [],
					antonyms: [],
					example: 'She gave a cheerful hello.'
				}
			],
			synonyms: ['greeting'],
			antonyms: []
		}
	],
	license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
	sourceUrls: ['https://en.wiktionary.org/wiki/hello']
};

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('lookupWord', () => {
	it('returns entries for a valid word', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve([mockEntry])
			})
		);

		const result = await lookupWord('hello');
		const filtered = {
			...mockEntry,
			meanings: [
				{
					...mockEntry.meanings[0],
					synonyms: [],
					antonyms: [],
					definitions: [{ ...mockEntry.meanings[0].definitions[0], synonyms: [], antonyms: [] }]
				}
			]
		};
		expect(result).toEqual({ ok: true, entries: [filtered] });
	});

	it('returns not-found for a 404 response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404
			})
		);

		const result = await lookupWord('xyznotaword');
		expect(result).toEqual({ ok: false, error: 'not-found' });
	});

	it('returns network-error for non-404 failures', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500
			})
		);

		const result = await lookupWord('hello');
		expect(result).toEqual({ ok: false, error: 'network-error' });
	});

	it('returns network-error when fetch throws', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

		const result = await lookupWord('hello');
		expect(result).toEqual({ ok: false, error: 'network-error' });
	});

	it('returns not-found for empty input', async () => {
		const result = await lookupWord('   ');
		expect(result).toEqual({ ok: false, error: 'not-found' });
	});

	it('merges multiple API entries into one', async () => {
		const entry2 = {
			...mockEntry,
			phonetics: [{ text: '/hɛˈloʊ/' }],
			meanings: [
				{
					partOfSpeech: 'verb',
					definitions: [{ definition: 'To say hello', synonyms: [], antonyms: [] }],
					synonyms: [],
					antonyms: []
				}
			],
			sourceUrls: ['https://en.wiktionary.org/wiki/hello#Verb']
		};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve([mockEntry, entry2])
			})
		);

		const result = await lookupWord('hello');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].meanings).toHaveLength(2);
		expect(result.entries[0].meanings[0].partOfSpeech).toBe('noun');
		expect(result.entries[0].meanings[1].partOfSpeech).toBe('verb');
		expect(result.entries[0].phonetics).toHaveLength(2);
	});

	it('trims and lowercases the word', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve([mockEntry])
		});
		vi.stubGlobal('fetch', mockFetch);

		await lookupWord('  Hello  ');
		expect(mockFetch).toHaveBeenCalledWith('https://api.dictionaryapi.dev/api/v2/entries/en/hello');
	});
});
