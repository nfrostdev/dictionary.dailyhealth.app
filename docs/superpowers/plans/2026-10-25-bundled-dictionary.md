# Bundled Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dictionaryapi.dev dependency with a kid-filtered dictionary built from English Wiktionary and served as static JSON shards from the app's own origin.

**Architecture:** A Python build script (`scripts/dict/build.py`) reads the kaikki.org English Wiktionary JSONL dump, keeps the top 100k words by wordfreq, drops unsuitable senses by Wiktionary tag, caps senses, and writes one JSON file per three-letter prefix into `static/dict/`. The generated files are committed. At runtime `lookupWord()` fetches `/dict/<key>.json` from the same origin, maps the record to the existing `DictionaryEntry` type, and runs the existing content filter. No external requests remain.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes) + TypeScript, Vitest, Playwright + axe-core, @vite-pwa/sveltekit (workbox), Cloudflare Pages, Python 3 + wordfreq 3.1.1 (build-time only).

## Global Constraints

- Data source: `https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl` (English Wiktionary, CC BY-SA 4.0). Attribution must appear in the UI footer and README.
- Word list: wordfreq `top_n_list('en', 100000)`.
- Max 3 senses per part of speech. Example sentences only of type `example`, under 160 characters.
- Shard file name = first three characters of the lowercased word, each character outside `a-z` replaced by `_`, padded with `_` to length 3. Python (`shard_key`) and TypeScript (`shardKey`) must agree.
- Cloudflare Pages limit: 20,000 files per deploy, 25 MiB per file.
- Not-found copy must not claim the word doesn't exist: heading is exactly `That word isn't in this dictionary`.
- Privacy: after this change the app makes zero requests to other origins. CSP `connect-src 'self'`.
- Kid-friendly copy at first-grade reading level; WCAG AAA (7:1 contrast, visible focus rings).
- Code style: tabs, single quotes, Prettier (`npm run lint` must pass). `static/` is already in `.prettierignore`.
- Vitest has `requireAssertions: true`: every test needs an `expect()`.
- Local npm 10 crashes on `npm update`/`audit fix` in this repo; plain `npm ci`/`npm run …` work. Do not add npm dependencies in this plan.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File                                              | Responsibility                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/dict/build.py` (create)                  | Dump → filtered, capped, sharded JSON in `static/dict/`; self-checks spot words |
| `scripts/dict/requirements.txt` (create)          | Pins `wordfreq==3.1.1`                                                          |
| `static/dict/*.json` (generated, committed)       | ~6,300 shard files + `_meta.json`                                               |
| `src/lib/types/dictionary.ts` (modify)            | Add `Shard`, `ShardEntry`, `ShardMeaning`, `ShardSense` types                   |
| `src/lib/api/shard-key.ts` (create)               | `shardKey(word)`, mirror of Python `shard_key`                                  |
| `src/lib/api/dictionary.ts` (rewrite)             | `lookupWord()` over static shards                                               |
| `src/lib/api/*.test.ts`                           | Unit tests (mocked fetch) + data-integrity tests over the real `static/dict`    |
| `src/lib/components/ErrorMessage.svelte` (modify) | Not-found copy                                                                  |
| `src/routes/+layout.svelte` (modify)              | Footer attribution                                                              |
| `_headers`, `vite.config.ts` (modify)             | CSP to `'self'`; workbox runtime cache for `/dict/` shards                      |
| `tests/e2e/search.spec.ts` (modify)               | Copy update, proper-noun lookup, no-external-requests guard                     |
| `CLAUDE.md`, `README.md`, `.gitignore` (modify)   | Data source, rebuild steps, licensing                                           |

---

### Task 1: Dictionary build script and generated shards

**Files:**

- Create: `scripts/dict/build.py`
- Create: `scripts/dict/requirements.txt`
- Modify: `.gitignore` (append `.venv-dict`)
- Generate: `static/dict/*.json`, `static/dict/_meta.json`

**Interfaces:**

- Produces: shard files at `static/dict/<key>.json`, each a JSON object `{ [lowercaseWord]: { w?: string, ipa?: string, m: [{ p: string, d: [{ d: string, x?: string }] }] } }`.
  - `w` = display form, present only when it differs from the key (e.g. `"january": {"w": "January", …}`).
  - `ipa` = one IPA pronunciation, US-tagged preferred.
  - `m` = meanings in display order; `p` = part-of-speech label (one of `noun`, `verb`, `adjective`, `adverb`, `interjection`, `preposition`, `pronoun`, `conjunction`, `determiner`, `number`, `proper noun`); `d` = 1–3 senses with definition `d` and optional example `x`.
- Produces: `static/dict/_meta.json` = `{ source, sourceUrl, license: "CC BY-SA 4.0", licenseUrl, built, words }`.
- Produces: shard naming rule (see Global Constraints) consumed by Task 2's `shardKey`.

**Input for development:** a pre-filtered copy of the 2026-10-21 dump already exists at `/tmp/claude-1000/-var-home-Banyu-Projects/eac8024a-199e-4a9f-8284-97d2e947daed/scratchpad/dictsize/candidates.jsonl.gz` (132 MB, 150,846 English entries whose lowercased headword is in the wordfreq top 100k). The script's own filter is a superset of the one used to make it, so building from this file gives the same output as streaming the full 3.4 GB dump. Use it. If it is missing, stream the full dump instead (command in Step 4; ~5 minutes).

- [ ] **Step 1: Create the requirements file and ignore the venv**

`scripts/dict/requirements.txt`:

```text
wordfreq==3.1.1
```

Append to `.gitignore`:

```text
# Dictionary build venv
.venv-dict
```

Create the venv:

```bash
cd /home/Banyu/Projects/dictionary.dailyhealth.app
python3 -m venv .venv-dict && .venv-dict/bin/pip install -q -r scripts/dict/requirements.txt
```

Expected: exits 0.

- [ ] **Step 2: Write the build script**

`scripts/dict/build.py`:

```python
#!/usr/bin/env python3
"""Build the bundled kids dictionary from kaikki.org's English Wiktionary dump.

Usage:
  curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \\
    | .venv-dict/bin/python -I scripts/dict/build.py - static/dict

The input may be a path, a .gz path, or '-' for stdin. Keeps the wordfreq top
100k words, drops unsuitable senses by Wiktionary tag, caps senses per part of
speech, and writes one JSON file per three-letter prefix. File naming must
match shardKey() in src/lib/api/shard-key.ts.
"""

import datetime
import gzip
import json
import re
import sys
from pathlib import Path

from wordfreq import top_n_list

WORD_LIMIT = 100_000
MAX_SENSES = 3
MAX_EXAMPLE_LEN = 160

POS_LABELS = {
    'noun': 'noun',
    'verb': 'verb',
    'adj': 'adjective',
    'adv': 'adverb',
    'intj': 'interjection',
    'prep': 'preposition',
    'pron': 'pronoun',
    'conj': 'conjunction',
    'det': 'determiner',
    'num': 'number',
    'postp': 'adverb',  # "ago"
    'name': 'proper noun',
}

# Senses carrying any of these Wiktionary tags or topics are dropped.
BAD_TAGS = {
    'vulgar', 'offensive', 'derogatory', 'pejorative', 'slur', 'ethnic', 'obscene',
    'slang', 'archaic', 'obsolete', 'dated', 'rare', 'nonstandard', 'euphemistic', 'humorous',
}
BAD_TOPICS = {'sexuality', 'sex', 'drugs', 'pharmacology', 'pornography', 'lgbtq'}

# Proper nouns are mostly people and places; keep only senses in these categories.
PROPER_NOUN_CATEGORIES = re.compile(
    r'^(Months|Days of the week|Countries in |Continents|Planets of the Solar System'
    r'|Dwarf planets|Oceans|Holidays|Languages$|States of the United States'
    r'|Provinces and territories of Canada)'
)

# Build fails unless these exist; a value also pins the display form.
REQUIRED = {
    'hello': None,
    'tadpole': None,
    'mitten': None,
    'ago': None,
    'italian': 'Italian',
    'january': 'January',
    'monday': None,
    'jupiter': None,
    'france': None,
    'africa': None,
    'america': None,
}


def shard_key(word):
    return re.sub(r'[^a-z]', '_', word[:3]).ljust(3, '_')


def read_lines(src):
    if src == '-':
        return sys.stdin
    if src.endswith('.gz'):
        return gzip.open(src, 'rt', encoding='utf-8')
    return open(src, encoding='utf-8')


def pick_ipa(entry):
    sounds = [s for s in entry.get('sounds', []) if s.get('ipa')]
    us = [s for s in sounds if 'US' in s.get('tags', [])]
    return (us or sounds or [{}])[0].get('ipa')


def pick_example(sense):
    for ex in sense.get('examples', []):
        text = (ex.get('text') or '').strip()
        if ex.get('type') == 'example' and 0 < len(text) < MAX_EXAMPLE_LEN:
            return text
    return None


def keep_sense(sense, key, pos):
    if not sense.get('glosses'):
        return False
    if set(sense.get('tags', [])) & BAD_TAGS:
        return False
    if set(sense.get('topics', [])) & BAD_TOPICS:
        return False
    # "Alternative letter-case form of Italian" adds nothing under the same key.
    if any((a.get('word') or '').lower() == key for a in sense.get('alt_of', [])):
        return False
    if pos == 'name':
        names = [c.get('name', '') if isinstance(c, dict) else c for c in sense.get('categories', [])]
        return any(PROPER_NOUN_CATEGORIES.match(n) for n in names)
    return True


def collect(src, words):
    """key -> list of (rank, order, display, ipa, label, senses)."""
    contributions = {}
    order = 0
    for line in read_lines(src):
        entry = json.loads(line)
        display = entry.get('word') or ''
        key = display.lower()
        pos = entry.get('pos')
        if key not in words or entry.get('lang_code') != 'en' or pos not in POS_LABELS:
            continue
        senses = []
        for s in entry.get('senses', []):
            if keep_sense(s, key, pos):
                sense = {'d': s['glosses'][-1].strip()}
                example = pick_example(s)
                if example:
                    sense['x'] = example
                senses.append(sense)
        if not senses:
            continue
        # Lowercase words first, then capitalized ones, then proper nouns,
        # so "polish" (shine) leads and "Polish" (from Poland) follows.
        rank = 2 if pos == 'name' else (0 if display == key else 1)
        contributions.setdefault(key, []).append(
            (rank, order, display, pick_ipa(entry), POS_LABELS[pos], senses)
        )
        order += 1
    return contributions


def merge(key, parts):
    parts.sort(key=lambda p: (p[0], p[1]))
    meanings = {}
    for _, _, _, _, label, senses in parts:
        bucket = meanings.setdefault(label, [])
        for s in senses:
            if len(bucket) < MAX_SENSES and s not in bucket:
                bucket.append(s)
    record = {'m': [{'p': label, 'd': defs} for label, defs in meanings.items()]}
    display = key if any(p[2] == key for p in parts) else parts[0][2]
    if display != key:
        record['w'] = display
    ipa = next((p[3] for p in parts if p[3]), None)
    if ipa:
        record['ipa'] = ipa
    return record


def write(shards, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.json'):
        old.unlink()
    sizes = []
    for name, shard in sorted(shards.items()):
        data = json.dumps(dict(sorted(shard.items())), ensure_ascii=False, separators=(',', ':')).encode()
        (out / f'{name}.json').write_bytes(data)
        sizes.append((len(gzip.compress(data, 9)), len(data), name))
    total = sum(len(s) for s in shards.values())
    meta = {
        'source': 'English Wiktionary via kaikki.org',
        'sourceUrl': 'https://kaikki.org/dictionary/English/',
        'license': 'CC BY-SA 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'built': datetime.date.today().isoformat(),
        'words': total,
    }
    (out / '_meta.json').write_text(json.dumps(meta, indent='\t') + '\n', encoding='utf-8')
    sizes.sort()
    print(f'{total} words in {len(shards)} shards; '
          f'{sum(s[1] for s in sizes) / 1e6:.1f} MB raw, {sum(s[0] for s in sizes) / 1e6:.1f} MB gzip')
    print('largest (gzip):', ', '.join(f'{n} {g / 1e3:.0f} KB' for g, _, n in sizes[-5:][::-1]))


def check(shards):
    problems = []
    for word, display in REQUIRED.items():
        record = shards.get(shard_key(word), {}).get(word)
        if record is None:
            problems.append(f'missing {word}')
        elif display and record.get('w', word) != display:
            problems.append(f'{word} displays as {record.get("w", word)}, expected {display}')
    polish = shards.get('pol', {}).get('polish')
    if not polish or 'w' in polish or polish['m'][0]['p'] == 'adjective':
        problems.append('polish should lead with the lowercase word')
    return problems


def main(src, out_dir):
    words = set(top_n_list('en', WORD_LIMIT))
    shards = {}
    for key, parts in collect(src, words).items():
        shards.setdefault(shard_key(key), {})[key] = merge(key, parts)
    write(shards, out_dir)
    problems = check(shards)
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
```

- [ ] **Step 3: Run the build against the pre-filtered input**

```bash
cd /home/Banyu/Projects/dictionary.dailyhealth.app
.venv-dict/bin/python -I scripts/dict/build.py \
  /tmp/claude-1000/-var-home-Banyu-Projects/eac8024a-199e-4a9f-8284-97d2e947daed/scratchpad/dictsize/candidates.jsonl.gz \
  static/dict
```

Expected: exit 0 and a report close to `~67000 words in ~6300 shards; ~16 MB raw, ~5.7 MB gzip`, largest shard `con` around 60 KB gzip.

If it exits 1 with `missing <word>`, the likely cause is a proper-noun category name not matching `PROPER_NOUN_CATEGORIES`. Inspect the raw entry:

```bash
.venv-dict/bin/python -I -c "
import gzip, json, sys
for l in gzip.open(sys.argv[1], 'rt'):
    e = json.loads(l)
    if e['word'].lower() == sys.argv[2]:
        for s in e.get('senses', []):
            print(e['pos'], s.get('tags'), s.get('glosses'), [c.get('name') if isinstance(c, dict) else c for c in s.get('categories', [])])
" /tmp/claude-1000/-var-home-Banyu-Projects/eac8024a-199e-4a9f-8284-97d2e947daed/scratchpad/dictsize/candidates.jsonl.gz monday
```

Fix the regex (or the filter) so the word survives, then re-run. Never remove a word from `REQUIRED` to make the build pass; if a word cannot be kept without loosening the kids filter, stop and report it.

- [ ] **Step 4: (Only if the pre-filtered file is missing) build from the full dump**

```bash
curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
  | .venv-dict/bin/python -I scripts/dict/build.py - static/dict
```

Expected: same as Step 3.

- [ ] **Step 5: Spot-check the output**

```bash
node -e "
const s = (k) => JSON.parse(require('fs').readFileSync('static/dict/' + k + '.json', 'utf8'));
console.log(JSON.stringify(s('hel').hello, null, 1));
console.log(JSON.stringify(s('jan').january));
console.log(JSON.stringify(s('pol').polish.m.map((m) => m.p)));
console.log(require('fs').readdirSync('static/dict').length, 'files');
"
cat static/dict/_meta.json
```

Expected: `hello` has `ipa` `/hɛˈloʊ/` and an `interjection` meaning with example `Hello, everyone.`; `january` has `"w":"January"` and a `proper noun` meaning; `polish` meanings start with `noun` or `verb`, not `adjective`; ~6,300 files (well under 20,000); `_meta.json` shows `CC BY-SA 4.0`.

- [ ] **Step 6: Commit script, then data**

```bash
git add scripts/dict .gitignore
git commit -m "feat: add Wiktionary dictionary build script

Builds kid-filtered static shards from the kaikki.org English Wiktionary
dump: wordfreq top 100k, tag-based sense filter, 3 senses per part of
speech, one file per three-letter prefix.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add static/dict
git commit -m "feat: add generated dictionary shards

Built from the 2026-10-21 kaikki.org dump with scripts/dict/build.py.
Data is CC BY-SA 4.0 (English Wiktionary).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Check `git status` afterwards: `.venv-dict` must not be staged.

---

### Task 2: Look words up from the static shards

**Files:**

- Modify: `src/lib/types/dictionary.ts`
- Create: `src/lib/api/shard-key.ts`
- Create: `src/lib/api/shard-key.test.ts`
- Rewrite: `src/lib/api/dictionary.ts`
- Rewrite: `src/lib/api/dictionary.test.ts`
- Create: `src/lib/api/dict-data.test.ts`

**Interfaces:**

- Consumes: shard files and format from Task 1 (`static/dict/<key>.json`, `_meta.json`).
- Consumes: `filterEntry(entry: DictionaryEntry): DictionaryEntry | null` and `isBlockedWord(word: string): boolean` from `src/lib/filter/content-filter.ts` (unchanged); `commonWords: string[]` from `src/lib/spelling/words.ts` (unchanged).
- Produces: `shardKey(word: string): string`; `lookupWord(word: string): Promise<DictionaryResult>` (signature unchanged, so `src/routes/+page.svelte` needs no change); types `Shard`, `ShardEntry`, `ShardMeaning`, `ShardSense`.

- [ ] **Step 1: Add the shard types**

Append to `src/lib/types/dictionary.ts`:

```ts
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
	ipa?: string;
	m: ShardMeaning[];
}

/** Contents of one static/dict/<key>.json file, keyed by lowercase word. */
export type Shard = Record<string, ShardEntry>;
```

- [ ] **Step 2: Write the failing shardKey test**

`src/lib/api/shard-key.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shardKey } from './shard-key';

describe('shardKey', () => {
	it.each([
		['hello', 'hel'],
		['a', 'a__'],
		['ox', 'ox_'],
		['t-shirt', 't_s'],
		["o'clock", 'o_c'],
		['café', 'caf'],
		['éclair', '_cl'],
		['3d', '_d_']
	])('%s -> %s', (word, key) => {
		expect(shardKey(word)).toBe(key);
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/api/shard-key.test.ts`
Expected: FAIL, cannot resolve `./shard-key`.

- [ ] **Step 4: Implement shardKey**

`src/lib/api/shard-key.ts`:

```ts
/**
 * Name of the static/dict file holding `word` (already lowercased): its first
 * three characters, anything outside a-z replaced by `_`, padded with `_`.
 * Must match shard_key() in scripts/dict/build.py.
 */
export function shardKey(word: string): string {
	return Array.from(word)
		.slice(0, 3)
		.map((c) => (c >= 'a' && c <= 'z' ? c : '_'))
		.join('')
		.padEnd(3, '_');
}
```

`Array.from` splits by code point, matching Python string slicing.

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/api/shard-key.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Replace the lookup tests**

Replace all of `src/lib/api/dictionary.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupWord } from './dictionary';
import type { Shard } from '$lib/types/dictionary';

const LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

const helShard: Shard = {
	hello: {
		ipa: '/hɛˈloʊ/',
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
					phonetics: [{ text: '/hɛˈloʊ/' }],
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

	it('leaves phonetics empty when the word has no pronunciation', async () => {
		stubFetch(shardResponse(helShard));

		const result = await lookupWord('helmet');

		expect(result.ok && result.entries[0].phonetics).toEqual([]);
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
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npx vitest run src/lib/api/dictionary.test.ts`
Expected: FAIL (the current code calls `https://api.dictionaryapi.dev/...` and returns the raw API shape).

- [ ] **Step 8: Rewrite the lookup**

Replace all of `src/lib/api/dictionary.ts` with:

```ts
import type { DictionaryEntry, DictionaryResult, Shard, ShardEntry } from '$lib/types/dictionary';
import { filterEntry, isBlockedWord } from '$lib/filter/content-filter';
import { shardKey } from './shard-key';

const LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

function toEntry(key: string, raw: ShardEntry): DictionaryEntry {
	const word = raw.w ?? key;
	return {
		word,
		phonetics: raw.ipa ? [{ text: raw.ipa }] : [],
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
	const trimmed = word.trim().toLowerCase();
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
```

- [ ] **Step 9: Run them to verify they pass**

Run: `npx vitest run src/lib/api/dictionary.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 10: Write the data-integrity tests**

These run against the real generated files, so they guard the Python/TypeScript naming contract and the data shape. `src/lib/api/dict-data.test.ts`:

```ts
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

	it('records the CC BY-SA license', () => {
		const meta = JSON.parse(readFileSync(join(DICT_DIR, '_meta.json'), 'utf8'));
		expect(meta.license).toBe('CC BY-SA 4.0');
	});
});
```

- [ ] **Step 11: Run all unit tests**

Run: `npx vitest run`
Expected: PASS for every file. If `covers every word the spelling suggestions can offer` lists words, do not weaken the test: report the list (it means Task 1's filter needs adjusting).

- [ ] **Step 12: Type check and lint**

Run: `npm run check && npm run lint`
Expected: 0 errors. Fix formatting with `npm run format` if Prettier complains about the new files.

- [ ] **Step 13: Commit**

```bash
git add src/lib/types/dictionary.ts src/lib/api
git commit -m "feat: look words up from bundled dictionary shards

lookupWord() now fetches /dict/<key>.json from the app's own origin
instead of dictionaryapi.dev. Data-integrity tests check the Python and
TypeScript shard naming agree and that every spelling suggestion has an
entry.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Copy, attribution, CSP, offline cache, e2e and docs

**Files:**

- Modify: `src/lib/components/ErrorMessage.svelte` (not-found heading)
- Modify: `src/routes/+layout.svelte` (footer)
- Modify: `_headers`
- Modify: `vite.config.ts` (workbox `runtimeCaching`)
- Modify: `tests/e2e/search.spec.ts`
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**

- Consumes: `lookupWord()` from Task 2 and shard files from Task 1 (the e2e tests hit the real built shards via `vite preview`, no mocking needed).
- Produces: nothing used by other tasks.

- [ ] **Step 1: Update the e2e tests first**

In `tests/e2e/search.spec.ts`:

Change the assertion in `shows error for non-existent word` from

```ts
await expect(alert).toContainText("We couldn't find that word");
```

to

```ts
await expect(alert).toContainText("That word isn't in this dictionary");
```

Add these two tests inside the `test.describe('Search', …)` block, after `shows error for non-existent word`:

```ts
test('shows proper nouns with their capital letter', async ({ page }) => {
	await page.goto('/');

	await page.locator('#search-input').fill('january');
	await page.locator('button[type="submit"]').click();

	const result = page.locator('article');
	await expect(result).toBeVisible({ timeout: 10000 });
	await expect(result.locator('h2')).toHaveText('January');
});

test('makes no requests to other websites', async ({ page, baseURL }) => {
	const origin = new URL(baseURL!).origin;
	const external: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.protocol.startsWith('http') && url.origin !== origin) external.push(url.href);
	});

	await page.goto('/');
	await page.locator('#search-input').fill('hello');
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('article')).toBeVisible({ timeout: 10000 });

	expect(external).toEqual([]);
});
```

- [ ] **Step 2: Run e2e to verify the copy test fails**

Run: `npx playwright test tests/e2e/search.spec.ts`
Expected: `shows error for non-existent word` FAILS (old copy). The other Search tests pass, since Task 2 already serves words from `/dict/`.

If Playwright's bundled browser is missing, run `npx playwright install chromium` first.

- [ ] **Step 3: Change the not-found copy**

In `src/lib/components/ErrorMessage.svelte`, change

```svelte
<p class="text-xl font-semibold">We couldn't find that word</p>
```

to

```svelte
<p class="text-xl font-semibold">That word isn't in this dictionary</p>
```

Leave the suggestions block and `Check the spelling and try again!` unchanged.

- [ ] **Step 4: Add the attribution footer**

In `src/routes/+layout.svelte`, replace

```svelte
<footer class="py-6 text-center text-sm text-text-muted">
	<p>A free dictionary for kids. No tracking, no ads.</p>
</footer>
```

with

```svelte
<footer class="py-6 text-center text-sm text-text-muted">
	<p>A free dictionary for kids. No tracking, no ads.</p>
	<p class="mt-1">
		Word meanings come from
		<a
			href="https://en.wiktionary.org/"
			class="rounded text-primary underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
			>Wiktionary</a
		>
		(<a
			href="https://creativecommons.org/licenses/by-sa/4.0/"
			class="rounded text-primary underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
			>CC BY-SA 4.0</a
		>).
	</p>
</footer>
```

(Links are navigation only; they make no requests until clicked, so the no-external-requests test still holds.)

- [ ] **Step 5: Tighten the CSP**

In `_headers`, in the `Content-Security-Policy` line, replace

```text
connect-src 'self' https://api.dictionaryapi.dev; media-src 'self' https://api.dictionaryapi.dev;
```

with

```text
connect-src 'self'; media-src 'self';
```

(Pronunciation uses the browser's speech synthesis, not remote audio, so `media-src` needs no external origin.)

- [ ] **Step 6: Cache shards for offline use**

In `vite.config.ts`, replace the `runtimeCaching` entry

```ts
{
	urlPattern: /^https:\/\/api\.dictionaryapi\.dev/,
	handler: 'NetworkFirst',
	options: {
		cacheName: 'dictionary-api',
		expiration: { maxEntries: 500 }
	}
}
```

with

```ts
{
	// Shards are cached as they are used, never precached (there are ~6,300)
	urlPattern: /\/dict\/[a-z_]{3}\.json$/,
	handler: 'StaleWhileRevalidate',
	options: {
		cacheName: 'dictionary-shards',
		expiration: { maxEntries: 1000 }
	}
}
```

Leave `globPatterns` as is: it does not include `json`, so shards stay out of the precache.

- [ ] **Step 7: Verify the precache stayed small**

Run: `npm run build && grep -c '/dict/' .svelte-kit/output/client/sw.js || true; ls .svelte-kit/output/client/dict | wc -l`
Expected: the grep count is `1` or `0` lines mentioning `/dict/` (only the runtime-caching regex, no shard URLs in the precache manifest); the `ls` shows ~6,300 files copied into the build. If the service worker is emitted somewhere else, locate it with `find .svelte-kit/output -name 'sw.js'` and check that file.

- [ ] **Step 8: Run all e2e tests**

Run: `npx playwright test`
Expected: all pass, including the accessibility tests (axe checks the new footer link contrast and the error state).

- [ ] **Step 9: Update CLAUDE.md**

In `CLAUDE.md`:

Replace the Project Overview sentence

```text
Single-page search app that looks up words via the free dictionaryapi.dev API.
```

with

```text
Single-page search app that looks words up in a bundled, kid-filtered dictionary built from English Wiktionary and served as static JSON shards from the app's own origin.
```

In Architecture, replace

```text
- **PWA** via `@vite-pwa/sveltekit` (NetworkFirst API caching, CacheFirst static assets)
```

with

```text
- **PWA** via `@vite-pwa/sveltekit` (StaleWhileRevalidate runtime cache for dictionary shards, precached app shell)
- **Dictionary data** in `static/dict/<key>.json`, one file per three-letter prefix, generated by `scripts/dict/build.py` (see README). Never hand-edit; rebuild instead. `shardKey()` in `src/lib/api/shard-key.ts` must match `shard_key()` in the build script.
```

In Key Conventions, replace

```text
- Privacy: zero cookies, zero analytics, zero third-party scripts. Only external request is to dictionaryapi.dev
```

with

```text
- Privacy: zero cookies, zero analytics, zero third-party scripts, zero external requests (an e2e test enforces this). CSP `connect-src 'self'`
- Missing words show "That word isn't in this dictionary": never say a word doesn't exist
```

- [ ] **Step 10: Update README.md**

In the Tech Stack list, replace

```markdown
- [Free Dictionary API](https://dictionaryapi.dev/)
```

with

```markdown
- Word data from [English Wiktionary](https://en.wiktionary.org/) via [kaikki.org](https://kaikki.org/), bundled as static files
```

Add this section before `## Development`:

````markdown
## Dictionary data

Definitions live in `static/dict/`, one JSON file per three-letter prefix (`hel.json` holds "hello", "helmet", …), so a lookup downloads a few KB and works offline once cached. The files are generated, not hand-edited. To rebuild from the latest Wiktionary dump (3.4 GB, streamed, ~5 minutes):

```sh
python3 -m venv .venv-dict
.venv-dict/bin/pip install -r scripts/dict/requirements.txt
curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
  | .venv-dict/bin/python -I scripts/dict/build.py - static/dict
npx vitest run src/lib/api/dict-data.test.ts
```

The build keeps the 100,000 most common English words (by [wordfreq](https://github.com/rspeer/wordfreq)), drops senses Wiktionary tags as vulgar, offensive, slang, archaic and similar, and keeps up to three senses per part of speech. The app's content filter runs on top at lookup time.

### License

The dictionary data in `static/dict/` is derived from English Wiktionary and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
````

- [ ] **Step 11: Lint, check, and run everything**

Run: `npm run lint && npm run check && npx vitest run && npx playwright test`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src/lib/components/ErrorMessage.svelte src/routes/+layout.svelte _headers vite.config.ts tests/e2e/search.spec.ts CLAUDE.md README.md
git commit -m "feat: serve dictionary from own origin only

Not-found copy no longer claims a word doesn't exist, footer credits
Wiktionary (CC BY-SA 4.0), CSP drops dictionaryapi.dev, shards get a
StaleWhileRevalidate offline cache, and an e2e test fails on any
request to another origin.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
