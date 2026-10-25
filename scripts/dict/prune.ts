// Prunes the built shards with the app's own content filter, so nothing the
// runtime would block or hide ships in static/dict. Idempotent.
// Usage: node scripts/dict/prune.ts static/dict
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { DictionaryEntry } from '../../src/lib/types/dictionary.ts';
import { isBlockedWord, filterEntry } from '../../src/lib/filter/content-filter.ts';

type Sense = { d: string; x?: string };
type Raw = { w?: string; s?: string; say?: string; m: { p: string; d: Sense[] }[] };

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node scripts/dict/prune.ts <dict-dir>');
	process.exit(1);
}

let blocked = 0;
let filtered = 0;
let senses = 0;
let examples = 0;
let total = 0;

for (const file of readdirSync(dir)) {
	if (file === '_meta.json') continue;
	const path = join(dir, file);
	const before = readFileSync(path, 'utf8');
	const shard: Record<string, Raw> = JSON.parse(before);
	const kept: Record<string, Raw> = {};

	for (const [key, raw] of Object.entries(shard)) {
		if (isBlockedWord(key)) {
			blocked++;
			examples += raw.m.reduce((n, m) => n + m.d.filter((s) => s.x).length, 0);
			continue;
		}
		const candidate = {
			word: key,
			meanings: raw.m.map(({ p, d }) => ({
				partOfSpeech: p,
				definitions: d.map(({ d, x }) => ({ definition: d, example: x })),
				synonyms: [],
				antonyms: []
			})),
			license: { name: '', url: '' },
			sourceUrls: []
		} satisfies DictionaryEntry;
		const entry = filterEntry(candidate);
		if (!entry) {
			filtered++;
			senses += raw.m.reduce((n, m) => n + m.d.length, 0);
			examples += raw.m.reduce((n, m) => n + m.d.filter((s) => s.x).length, 0);
			continue;
		}
		const count = raw.m.reduce((n, m) => n + m.d.length, 0);
		const m = entry.meanings.map((meaning) => ({
			p: meaning.partOfSpeech,
			d: meaning.definitions.map((def) => ({
				d: def.definition,
				...(def.example ? { x: def.example } : {})
			}))
		}));
		senses += count - m.reduce((n, x) => n + x.d.length, 0);
		examples += raw.m.reduce((n, x) => n + x.d.filter((s) => s.x).length, 0);
		examples -= m.reduce((n, x) => n + x.d.filter((s) => s.x).length, 0);
		kept[key] = { ...raw, m };
	}

	const n = Object.keys(kept).length;
	total += n;
	if (n === 0) {
		unlinkSync(path);
		continue;
	}
	// Same formatting as build.py: compact separators, keys already sorted
	const after = JSON.stringify(kept);
	if (after !== before) writeFileSync(path, after);
}

const metaPath = join(dir, '_meta.json');
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
meta.words = total;
writeFileSync(metaPath, JSON.stringify(meta, null, '\t') + '\n');

console.log(
	`pruned: ${blocked} blocked keys, ${filtered} filtered keys, ${senses} senses, ${examples} examples removed; ${total} words`
);
