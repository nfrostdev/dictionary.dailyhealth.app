import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shardKey } from './shard-key';
import { toEntry } from './dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';
import { commonWords } from '$lib/spelling/words';
import type { Shard } from '$lib/types/dictionary';

const DICT_DIR = join(process.cwd(), 'static', 'dict');
const files = readdirSync(DICT_DIR).filter((f) => f !== '_meta.json');
const shards = new Map<string, Shard>(
	files.map((f) => [
		f.slice(0, -'.json'.length),
		JSON.parse(readFileSync(join(DICT_DIR, f), 'utf8'))
	])
);

const HTML_TAG = /<\/?[a-z][^>]*>/i;

function find(word: string) {
	return shards.get(shardKey(word))?.[word];
}

describe('static dictionary data', () => {
	it('names every file as a three-character shard', () => {
		expect(files.filter((f) => !/^[a-z_]{3}\.json$/.test(f))).toEqual([]);
	});

	it('stays well under the Cloudflare Pages file limit', () => {
		expect(files.length).toBeGreaterThan(1000);
		expect(files.length).toBeLessThan(15000);
	});

	it('files every word under its own shard key', () => {
		const misfiled: string[] = [];
		for (const [key, shard] of shards) {
			for (const word of Object.keys(shard)) {
				if (shardKey(word) !== key) misfiled.push(`${word} in ${key}`);
			}
		}
		expect(misfiled).toEqual([]);
	});

	it('has well-formed entries', () => {
		const problems: string[] = [];
		for (const shard of shards.values()) {
			for (const [word, entry] of Object.entries(shard)) {
				if (word !== word.toLowerCase()) problems.push(`${word}: key not lowercase`);
				if (entry.m.length === 0) problems.push(`${word}: no meanings`);
				for (const m of entry.m) {
					if (!m.p) problems.push(`${word}: empty part of speech`);
					if (m.d.length < 1 || m.d.length > 3) problems.push(`${word}: ${m.d.length} senses`);
					for (const s of m.d) {
						if (!s.d.trim()) problems.push(`${word}: empty definition`);
						if (HTML_TAG.test(s.d) || HTML_TAG.test(s.x ?? '')) problems.push(`${word}: HTML`);
					}
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it('covers every word the spelling suggestions can offer', () => {
		expect(commonWords.filter((w) => !find(w))).toEqual([]);
	});

	it('has the spot-check words', () => {
		expect(find('hello')?.m.length).toBeGreaterThan(0);
		expect(find('tadpole')?.m.length).toBeGreaterThan(0);
		expect(find('january')?.w).toBe('January');
	});

	it('keeps the required words visible after the content filter', () => {
		const required = [
			'hello',
			'tadpole',
			'mitten',
			'ago',
			'italian',
			'january',
			'december',
			'monday',
			'jupiter',
			'france',
			'africa',
			'america',
			'japan',
			'germany',
			'canada',
			'texas',
			'england',
			'aardvark'
		];
		const hidden = required.filter((w) => {
			const raw = find(w);
			return !raw || !filterEntry(toEntry(w, raw));
		});
		expect(hidden).toEqual([]);
	});

	it('keeps every spelling-suggestion word visible after the content filter', () => {
		const hidden = commonWords.filter((w) => {
			const raw = find(w);
			return !raw || !filterEntry(toEntry(w, raw));
		});
		expect(hidden).toEqual([]);
	});

	it('ships nothing the runtime content filter would remove (run scripts/dict/prune.ts)', () => {
		const blocked: string[] = [];
		const changed: string[] = [];
		const texts = (e: {
			meanings: { definitions: { definition: string; example?: string }[] }[];
		}) => e.meanings.map((m) => m.definitions.map((d) => [d.definition, d.example]));
		for (const shard of shards.values()) {
			for (const [word, raw] of Object.entries(shard)) {
				if (isBlockedWord(word)) {
					blocked.push(word);
					continue;
				}
				const entry = toEntry(word, raw);
				const filtered = filterEntry(entry);
				if (!filtered || JSON.stringify(texts(filtered)) !== JSON.stringify(texts(entry)))
					changed.push(word);
			}
		}
		expect({ blocked, changed }).toEqual({ blocked: [], changed: [] });
	});

	it('records the CC BY-SA license', () => {
		const meta = JSON.parse(readFileSync(join(DICT_DIR, '_meta.json'), 'utf8'));
		expect(meta.license).toBe('CC BY-SA 4.0');
	});

	it('ships spelling syllables and respellings, not IPA', () => {
		type Pron = { s?: string; say?: string; ipa?: string };
		const bad: string[] = [];
		let withS = 0;
		let withSay = 0;
		for (const shard of shards.values()) {
			for (const [word, raw] of Object.entries(shard)) {
				const { s, say, ipa } = raw as unknown as Pron;
				if (ipa !== undefined) bad.push(`${word} still has ipa`);
				if (s !== undefined) {
					withS++;
					if (s.replace(/\u00b7/g, '').toLowerCase() !== word) bad.push(`${word} s=${s}`);
				}
				if (say !== undefined) {
					withSay++;
					const upper = say.split('-').filter((p) => p === p.toUpperCase());
					if (!/^[a-z]+(-[a-z]+)*$/i.test(say) || upper.length !== 1)
						bad.push(`${word} say=${say}`);
				}
			}
		}
		expect(bad).toEqual([]);
		expect(withS).toBeGreaterThan(1000);
		expect(withSay).toBeGreaterThan(1000);
	});

	it('gives agriculture its syllables and respelling', () => {
		const raw = find('agriculture') as unknown as { s?: string; say?: string };
		expect(raw.s).toBe('ag\u00b7ri\u00b7cul\u00b7ture');
		expect(raw.say).toBe('AG-rih-kul-cher');
	});
});
