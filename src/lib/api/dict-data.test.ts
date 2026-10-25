import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shardKey } from './shard-key';
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

	it('covers every word the spelling suggestions can offer', () => {
		expect(commonWords.filter((w) => !find(w))).toEqual([]);
	});

	it('has the spot-check words', () => {
		expect(find('hello')?.m.length).toBeGreaterThan(0);
		expect(find('tadpole')?.m.length).toBeGreaterThan(0);
		expect(find('january')?.w).toBe('January');
	});

	it('records the CC BY-SA license', () => {
		const meta = JSON.parse(readFileSync(join(DICT_DIR, '_meta.json'), 'utf8'));
		expect(meta.license).toBe('CC BY-SA 4.0');
	});
});
