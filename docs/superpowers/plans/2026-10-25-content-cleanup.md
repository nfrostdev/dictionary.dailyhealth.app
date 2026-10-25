# Content Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop inappropriate words and senses from reaching kids, and stop them from shipping in `static/dict/` at all.

**Architecture:** Two layers. The Python build (`scripts/dict/build.py`) drops more senses using Wiktionary tags and categories, and `scripts/dict/pron.py` avoids rude-looking respellings. A new Node step (`scripts/dict/prune.ts`) then runs the app's own runtime filter (`src/lib/filter/content-filter.ts`) over the built shards and writes back only what the app would show. A data test enforces that the runtime filter is a no-op on shipped data.

**Tech Stack:** Python 3 (`.venv-dict`), Node 22 type stripping (`node file.ts`, no build step), TypeScript, Vitest.

## Global Constraints

- Build input (never download the dump): `.venv-dict/bin/python -I scripts/dict/build.py /tmp/claude-1000/-var-home-Banyu-Projects/eac8024a-199e-4a9f-8284-97d2e947daed/scratchpad/dictsize/candidates.jsonl.gz static/dict`
- Do not touch dependencies (no npm install/update; npm 10 crashes here).
- Targeted, not topic-wide: do not block whole topics like nudity, death or drugs. "naked eye", "depression", "kill", "drug" senses stay.
- Every REQUIRED word in build.py and every `commonWords` word must still be present and shown.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lint: `npx prettier --check . '!.superpowers/**'` and `npx eslint .`.
- Python tests: `.venv-dict/bin/python -I -m unittest discover -s scripts/dict -p 'test_*.py'`.

---

### Task 1: Tighter filters at build and runtime, safe respellings

**Files:**

- Modify: `scripts/dict/build.py` (BAD_TAGS, new BAD_CATEGORIES, `keep_sense`)
- Modify: `scripts/dict/pron.py` (rude-syllable guard)
- Modify: `src/lib/filter/content-filter.ts` (BLOCKED_WORDS, INAPPROPRIATE_PATTERNS)
- Test: `scripts/dict/test_build.py`, `scripts/dict/test_pron.py`, `src/lib/filter/content-filter.test.ts`

**Interfaces:**

- Produces: `keep_sense(sense, key, pos)` unchanged signature; `respell(ipa)` unchanged signature (may now return a softened or `None` result); `isBlockedWord`, `isInappropriate`, `filterEntry` unchanged signatures.

- [ ] **Step 1: build.py tags and categories.** Add `'Internet'` and `'Leet'` to `BAD_TAGS`. Add, right after `BAD_TOPICS`:

```python
# Sense-level categories that mark slurs, suicide, sexism and filter-dodging spellings.
BAD_CATEGORIES = re.compile(
    r'(ethnic slurs|slurs$|^Suicide$|^Sexism$|filter-avoidance spellings|^Sex$|^Sexuality$'
    r'|^Pornography$|^Prostitution$|^BDSM$)',
    re.I,
)
```

In `keep_sense`, after the BAD_TOPICS check, drop the sense when any of its category names (same extraction as the proper-noun branch: `c.get('name', '') if isinstance(c, dict) else c`) matches `BAD_CATEGORIES`. Move that category-name extraction into one local variable used by both places.

Also drop alternative-form senses that point at junk: if the gloss matches `^Alternative (form|spelling) of (.+?)\.?$` and the target contains `porn`, drop it (case-insensitive). Keep this a small named regex constant with a one-line comment.

Tests in `test_build.py`: a sense with tag `Internet` is dropped; a sense with category `{'name': 'English ethnic slurs'}` is dropped; a sense with category `{'name': 'Suicide'}` is dropped; `"Alternative form of porn star."` is dropped; a plain sense with category `{'name': 'Birdwatching'}` is kept.

- [ ] **Step 2: pron.py rude-syllable guard.** Respellings must never spell a swear word. After `respell` builds its syllables, apply:

```python
# Respellings must not spell a swear word; schwa "u" can be written "uh" instead.
RUDE_SOFTEN = {'kunt': 'kuhnt', 'slut': 'sluht', 'fuk': 'fuhk'}
RUDE = {'shit', 'twat', 'wank'}
```

Compare each syllable case-insensitively; replace a RUDE_SOFTEN syllable keeping its case (uppercase stays uppercase: `KUNT` -> `KUHNT`); if any syllable is in RUDE, return `None`. Tests in `test_pron.py`: `/sɪɡˈnɪfɪkənt/` -> `sig-NIF-ih-kuhnt`; `/ˈbɹeɪslət/` -> `BRAY-sluht`; an input that would produce `shit` returns `None` (use `/ˈʃɪt/`).

- [ ] **Step 3: content-filter.ts additions.** Add to `BLOCKED_WORDS` (new commented group, "sexual or crude words that slip past Wiktionary tags"): `cocksucker`, `cocksuckers`, `gangbang`, `gangbangs`, `gangbanging`, `pornstar`, `pornstars`, `porno`, `pornos`, `pornographer`, `pornographers`, `pimp`, `pimps`, `pimping`, `nuru`, `merkin`, `nudie`, `nudies`, `titty`, `titties`, `jizz`, `butthurt`.

Add to `INAPPROPRIATE_PATTERNS` (match existing style, each with a short group comment): `/\bporn/i`, `/\bsuicid/i`, `/\bsexy\b/i`, `/\bprostitut/i`, `/\bpubic\b/i`, `/\bslur\b/i`.

Add an example-only list (examples are optional, so stricter is cheap):

```ts
/** Extra patterns for example sentences only; definitions with these words stay. */
const EXAMPLE_ONLY_PATTERNS: RegExp[] = [/\bnaked\b/i, /\bnude\b/i, /\btied to a bed\b/i];
```

In `filterDefinition`, drop the example when it `isInappropriate` OR matches any `EXAMPLE_ONLY_PATTERNS`. Keep `isInappropriate`'s behavior unchanged.

Tests in `content-filter.test.ts`: `isBlockedWord('gangbang')` and `isBlockedWord('cocksucker')` true; a definition "Alternative form of porn star." is removed; a definition "A person who attempts suicide by hanging." is removed; a definition "Attractive, sexy (of a woman)." is removed; a definition "Bare, not covered by clothing." with example "He walked in naked." keeps the definition and loses the example; "Visible to the naked eye." as a definition is kept.

- [ ] **Step 4: Run** Python tests and `npx vitest run src/lib/filter`. All pass.

- [ ] **Step 5: Commit** in two commits (build/pron; content filter). Do not regenerate shards in this task.

---

### Task 2: Prune shards with the runtime filter, regenerate, enforce

**Files:**

- Create: `scripts/dict/prune.ts`
- Modify: `src/lib/api/dict-data.test.ts`, `README.md`, `CLAUDE.md` (one line under Architecture)
- Regenerate: `static/dict/*.json`

**Interfaces:**

- Consumes: `isBlockedWord(word: string): boolean`, `filterEntry(entry: DictionaryEntry): DictionaryEntry | null` from `src/lib/filter/content-filter.ts` (import by relative path; it only has an `import type` from `$lib`, which Node's type stripping erases). Do not import `src/lib/api/dictionary.ts` (it has runtime `$lib` imports Node cannot resolve).
- Shard format: `{ [key]: { w?: string, s?: string, say?: string, m: [{ p: string, d: [{ d: string, x?: string }] }] } }`, plus `_meta.json` with a `words` count.

- [ ] **Step 1: prune.ts.** `node scripts/dict/prune.ts <dir>`. For every shard file except `_meta.json`:
  - drop keys where `isBlockedWord(key)`;
  - map each entry to `{ word: key, meanings: m.map(({p,d}) => ({ partOfSpeech: p, definitions: d.map(({d,x}) => ({ definition: d, example: x })) })) }`, run `filterEntry`, drop the key if `null`, else write back `m` from the result (keep `x` only when the filtered definition still has an `example`), keeping `w`, `s`, `say` untouched;
  - delete a shard file that ends up empty;
  - rewrite files with the same JSON formatting build.py uses (read build.py's `write` and match it exactly, so an unchanged shard is byte-identical);
  - update `_meta.json` `words` to the new total, preserving its formatting style;
  - print one summary line: keys removed (blocked), keys removed (filtered), senses removed, examples removed.
  - It must be idempotent: a second run changes nothing and reports zeros.

- [ ] **Step 2: Data test.** In `dict-data.test.ts` add: for every key in every shard, `isBlockedWord(key)` is false, and `filterEntry(toEntry(key, raw))` deep-equals `toEntry(key, raw)` apart from the `synonyms: []` / `antonyms: []` fields filterEntry adds (compare definition texts and examples per meaning). Name it so a failure reads as "shipped data contains something the runtime filter would remove; run prune.ts".

- [ ] **Step 3: Regenerate.** Before rebuilding, copy the current `static/dict` to the scratchpad as `old-dict` for the comparison in Step 4. Run the build, then `node scripts/dict/prune.ts static/dict`, then run prune again and confirm zeros.

- [ ] **Step 4: Collateral report.** Write `.superpowers/sdd/cleanup/diff.md` listing every key removed and every sense removed versus `old-dict` (key, part of speech, definition text), grouped by reason where known. Then for each of these, state whether it is still shown and what: gangbang, cocksucker, pornstar, pron, nuru, merkin, nudie, pimping, prawn, reptilian, asher, hanger, jumper, dnp, sui, threateningly, butthurt, titty, jizz, foxy, bracelet (its `say`), significant (its `say`), cock, horny, depression, naked, cluster, kamikaze. Flag any removed sense that looks innocent.

- [ ] **Step 5: Docs.** README rebuild block: add `node scripts/dict/prune.ts static/dict` after the build line, with a short sentence saying prune runs the app's own content filter so blocked words never ship. CLAUDE.md: extend the Dictionary data bullet with "then pruned by `scripts/dict/prune.ts` with the runtime content filter".

- [ ] **Step 6: Verify.** Python tests, `npx vitest run`, `npm run check`, prettier + eslint, `npx playwright test`. All pass.

- [ ] **Step 7: Commit** (prune script + test + docs; regenerated shards as their own commit).
