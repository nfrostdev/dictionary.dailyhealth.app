import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupWord } from './dictionary';
import type { Shard } from '$lib/types/dictionary';

const LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

const helShard: Shard = {
	hello: {
		s: 'hel·lo',
		say: 'heh-LOH',
		m: [
			{
				p: 'interjection',
				d: [{ d: 'A greeting said when meeting someone.', x: 'Hello, everyone.' }]
			},
			{ p: 'verb', d: [{ d: 'To greet someone with "hello".' }] }
		]
	},
	helmet: { m: [{ p: 'noun', d: [{ d: 'A protective covering for the head.' }] }] }
};

function shardResponse(shard: Shard) {
	return { ok: true, status: 200, json: () => Promise.resolve(shard) };
}

function stubFetch(value: unknown) {
	const mockFetch = vi.fn().mockResolvedValue(value);
	vi.stubGlobal('fetch', mockFetch);
	return mockFetch;
}

beforeEach(() => {
	vi.unstubAllGlobals();
});

describe('lookupWord', () => {
	it('returns the entry for a word in its shard', async () => {
		const mockFetch = stubFetch(shardResponse(helShard));

		const result = await lookupWord('hello');

		expect(mockFetch).toHaveBeenCalledWith('/dict/hel.json');
		expect(result).toEqual({
			ok: true,
			entries: [
				{
					word: 'hello',
					syllables: 'hel·lo',
					sayIt: 'heh-LOH',
					meanings: [
						{
							partOfSpeech: 'interjection',
							definitions: [
								{
									definition: 'A greeting said when meeting someone.',
									example: 'Hello, everyone.',
									synonyms: [],
									antonyms: []
								}
							],
							synonyms: [],
							antonyms: []
						},
						{
							partOfSpeech: 'verb',
							definitions: [
								{ definition: 'To greet someone with "hello".', synonyms: [], antonyms: [] }
							],
							synonyms: [],
							antonyms: []
						}
					],
					license: LICENSE,
					sourceUrls: ['https://en.wiktionary.org/wiki/hello']
				}
			]
		});
	});

	it('omits syllables and sayIt when the word has no pronunciation', async () => {
		stubFetch(shardResponse(helShard));

		const result = await lookupWord('helmet');

		expect(result.ok).toBe(true);
		const entry = result.ok ? result.entries[0] : {};
		expect(entry).not.toHaveProperty('syllables');
		expect(entry).not.toHaveProperty('sayIt');
	});

	it('uses the display form for capitalized words', async () => {
		const mockFetch = stubFetch(
			shardResponse({
				january: { w: 'January', m: [{ p: 'proper noun', d: [{ d: 'The first month.' }] }] }
			})
		);

		const result = await lookupWord('january');

		expect(mockFetch).toHaveBeenCalledWith('/dict/jan.json');
		expect(result.ok && result.entries[0].word).toBe('January');
		expect(result.ok && result.entries[0].sourceUrls).toEqual([
			'https://en.wiktionary.org/wiki/January'
		]);
	});

	it('returns not-found when the shard lacks the word', async () => {
		stubFetch(shardResponse(helShard));

		const result = await lookupWord('helix');

		expect(result).toEqual({ ok: false, error: 'not-found' });
	});

	it('does not treat object prototype keys as words', async () => {
		stubFetch(shardResponse({}));

		const result = await lookupWord('constructor');

		expect(result).toEqual({ ok: false, error: 'not-found' });
	});

	it('returns not-found when the shard file does not exist', async () => {
		stubFetch({ ok: false, status: 404 });

		const result = await lookupWord('xyznotaword');

		expect(result).toEqual({ ok: false, error: 'not-found' });
	});

	it('returns network-error for other failed responses', async () => {
		stubFetch({ ok: false, status: 500 });

		const result = await lookupWord('hello');

		expect(result).toEqual({ ok: false, error: 'network-error' });
	});

	it('returns network-error when fetch throws', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

		const result = await lookupWord('hello');

		expect(result).toEqual({ ok: false, error: 'network-error' });
	});

	it('returns network-error when the shard is not valid JSON', async () => {
		stubFetch({
			ok: true,
			status: 200,
			json: () => Promise.reject(new SyntaxError('Unexpected token <'))
		});

		const result = await lookupWord('hello');

		expect(result).toEqual({ ok: false, error: 'network-error' });
	});

	it('returns not-found for empty input without fetching', async () => {
		const mockFetch = stubFetch(shardResponse(helShard));

		const result = await lookupWord('   ');

		expect(result).toEqual({ ok: false, error: 'not-found' });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('returns blocked for a blocked word without fetching', async () => {
		const mockFetch = stubFetch(shardResponse(helShard));

		const result = await lookupWord('fuck');

		expect(result).toEqual({ ok: false, error: 'blocked' });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('returns blocked when every definition is filtered out', async () => {
		stubFetch(
			shardResponse({
				hello: { m: [{ p: 'noun', d: [{ d: 'A vulgar term' }, { d: 'An obscene expression' }] }] }
			})
		);

		const result = await lookupWord('hello');

		expect(result).toEqual({ ok: false, error: 'blocked' });
	});

	it('trims and lowercases the word', async () => {
		const mockFetch = stubFetch(shardResponse(helShard));

		const result = await lookupWord('  Hello  ');

		expect(mockFetch).toHaveBeenCalledWith('/dict/hel.json');
		expect(result.ok && result.entries[0].word).toBe('hello');
	});

	it('treats curly apostrophes as straight ones', async () => {
		const donShard: Shard = {
			"don't": { m: [{ p: 'verb', d: [{ d: 'Do not.' }] }] }
		};
		const mockFetch = stubFetch(shardResponse(donShard));

		const result = await lookupWord('don\u2019t');

		expect(mockFetch).toHaveBeenCalledWith('/dict/don.json');
		expect(result.ok && result.entries[0].word).toBe("don't");
	});
});
