# Kid-Friendly Pronunciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the IPA line (which kids cannot read, and which was usually British) with spelling syllables (`ag·ri·cul·ture`), a sound-it-out respelling (`AG-rih-kul-cher`), and a Listen button restricted to on-device voices.

**Architecture:** Both strings are computed once at build time in a new `scripts/dict/pron.py` imported by `scripts/dict/build.py`, stored per word in the shards as `s` and `say`, and rendered by `WordResult.svelte`. IPA is no longer shipped or shown. The Listen button (`PhoneticPlayer.svelte`, already present) keeps using `speechSynthesis` but only with `localService` English voices.

**Tech Stack:** Python 3 + wordfreq + pyphen 0.18.1 (build only), stdlib `unittest`; SvelteKit 2 / Svelte 5 runes, TypeScript, Vitest, Playwright + axe.

## Global Constraints

- Zero external requests at runtime (e2e enforces). Speech must never use a voice whose `localService` is false.
- American pronunciation only. When no American or neutral IPA exists, emit no `say` (never fall back to British/RP or dialect lines).
- A syllable string, when present, must spell the word exactly once the `·` separators are removed (case-insensitive). Wrong-looking output is worse than none: omit when unsure.
- Separator for syllables is `·` (U+00B7). Respelling syllables are joined with `-`; the primary-stressed syllable is UPPERCASE, all others lowercase.
- Build: `.venv-dict/bin/python -I scripts/dict/build.py /tmp/claude-1000/-var-home-Banyu-Projects/eac8024a-199e-4a9f-8284-97d2e947daed/scratchpad/dictsize/candidates.jsonl.gz static/dict` (never download the dump). Rebuild must exit 0.
- Kid copy: first-grade reading level. No em dashes in UI copy.
- Do not touch npm dependencies (npm 10 crashes here; no install/update).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lint: `npx prettier --check . '!.superpowers/**'` and `npx eslint .`.

---

### Task 1: Build-time syllables and respelling

**Files:**

- Create: `scripts/dict/pron.py`, `scripts/dict/test_pron.py`
- Modify: `scripts/dict/build.py` (`pick_ipa`, `collect`, `merge`, `check`), `scripts/dict/requirements.txt` (add `pyphen==0.18.1`; it is already installed in `.venv-dict`)
- Regenerate: `static/dict/*.json`

**Interfaces produced (shard record fields):** `s?: string` (e.g. `"ag·ri·cul·ture"`), `say?: string` (e.g. `"AG-rih-kul-cher"`). Field `ipa` is removed from records.

- [ ] **Step 1: Pick American IPA.** Replace `pick_ipa` so it considers only phonemic transcriptions (string starts with `/`), and returns, in order: the first whose `tags` contain `General-American` or `US`; else the first with no `tags` and no `note`; else `None`. (Kaikki tags American IPA `General-American`; `US` is mostly on audio rows, which is why the old code fell back to British.) Untagged rows that carry a `note` are dialect lines (e.g. "Dublin", "Liverpool") and must be skipped.

- [ ] **Step 2: Write failing tests in `scripts/dict/test_pron.py`** (stdlib `unittest`, run with `.venv-dict/bin/python -I -m unittest discover -s scripts/dict -p 'test_*.py'`; since `-I` drops the script dir from `sys.path`, the test file inserts its own directory into `sys.path` before `import pron`). Required cases:
  - `respell('/ˈæɡ.ɹɪˌkʌl.t͡ʃɚ/') == 'AG-rih-kul-cher'`
  - `respell('/ˈhɛ.loʊ/')`-style and a dotless IPA: `respell('/sɛpˈtɛmbɚ/') == 'sep-TEM-ber'`
  - `respell('/ˈɛləfənt/') == 'EL-uh-funt'` (stressed checked vowel takes one consonant as coda, see Step 3)
  - `respell('/kæt/') == 'KAT'` (single syllable is uppercase)
  - `respell` returns `None` for IPA containing any symbol not in the table (e.g. `'/ˈxɔx/'`)
  - `count_syllables('/ˈæɡ.ɹɪˌkʌl.t͡ʃɚ/') == 4`, `count_syllables('/ˈeɪ.bl̩/') == 2`, `count_syllables('/aɪ/') == 1`
  - `syllables('agriculture', '/ˈæɡ.ɹɪˌkʌl.t͡ʃɚ/', ['ag','ri','cul','ture']) == 'ag·ri·cul·ture'`
  - `syllables('september', '/sɛpˈtɛmbɚ/', None) == 'sep·tem·ber'` (pyphen fallback)
  - `syllables('elephant', '/ˈɛləfənt/', None) is None` (pyphen gives 2 parts vs 3 sounds: omit)
  - `syllables('cat', '/kæt/', None) is None` (one syllable: nothing to show)
  - Wiktionary parts that do not re-spell the word (e.g. `['ag','ri','cul','tur']`) are rejected.

- [ ] **Step 3: Implement `pron.py`.**
  - **Tokenize** the IPA (strip `/`, drop `ˑ`, `ː`, `̯`, `ʰ`, combining tie U+0361 handled by matching `t͡ʃ`/`d͡ʒ` before single chars, treat `tʃ`/`dʒ` the same). Longest-match first over the table below. Boundaries: `.`, space, `ˈ` (primary, next syllable stressed), `ˌ` (secondary).
  - **Vowels** (nuclei; open-syllable form / closed-syllable form):
    `æ a/a`, `ɑ ah/o`, `ɒ ah/o`, `ɔ aw/aw`, `ʌ uh/u`, `ə uh/u`, `ɐ uh/u`, `ɛ eh/e`, `e eh/e`, `ɪ ih/i`, `ᵻ ih/i`, `i ee/ee`, `ʊ uu/uu`, `u oo/oo`, `ɵ oo/oo`, `eɪ ay/ay`, `aɪ eye/y`, `ɔɪ oy/oy`, `aʊ ow/ow`, `oʊ oh/oh`, `o oh/oh`, `ɚ er/er`, `ɝ er/er`, `ɜɹ er/er`, `ɑɹ ar/ar`, `ɔɹ or/or`, `oɹ or/or`, `ɛɹ air/air`, `eɹ air/air`, `ɪɹ eer/eer`, `iɹ eer/eer`, `ʊɹ oor/oor`, `uɹ oor/oor`, and syllabic consonants `l̩ ul`, `n̩ un`, `m̩ um` (U+0329 or U+030D mark).
    Rhotic vowel entries (`ɑɹ` etc.) match only when the `ɹ` is not followed by a vowel (`ˈvɛ.ɹi` = `veh-ree`, not `vair-ee`).
  - **Consonants:** `p b t d k g ɡ f v s z h m n l w` → same letter (`ɡ`→`g`), `ɹ r`→`r`, `ɾ`→`t`, `ʔ`→`t`, `θ ð`→`th`, `ʃ`→`sh`, `ʒ`→`zh`, `t͡ʃ tʃ`→`ch`, `d͡ʒ dʒ`→`j`, `ŋ`→`ng`, `j`→`y`, `ʍ`→`wh`, `x`→ unknown.
  - **Syllabify:** use IPA boundaries where present. Between two nuclei with no boundary, give the next syllable the longest consonant run that is a legal onset (any single consonant except `ŋ`; clusters: `pl bl kl gl fl sl pr br tr dr kr gr fr θr ʃr sp st sk sm sn sw tw dw kw gw θw spl spr str skr skw`), the rest stays as coda. Then: if a syllable is primary-stressed, has a checked vowel (`æ ɛ ɪ ʊ ʌ ɒ`) and no coda, and the next syllable's onset is non-empty, move the first onset consonant back as its coda (`ˈɛ.lə.fənt` → `ɛl.ə.fənt`).
  - **Spell** each syllable: onset letters + vowel (closed form if the syllable has a coda, else open form) + coda letters. Uppercase the primary-stressed syllable (if no `ˈ` and one syllable, uppercase it; if no `ˈ` and several, return `None`). Join with `-`. Any unknown symbol → `None`.
  - **`count_syllables(ipa)`** = number of nuclei found by the tokenizer (`None` if tokenizing fails).
  - **`syllables(word, ipa, parts)`**: needs `count_syllables(ipa) >= 2`. Try Wiktionary `parts` first, then `pyphen.Pyphen(lang='en_US').inserted(word.lower(), hyphen='·')`. Accept the first candidate whose part count equals the syllable count and whose parts joined equal `word.lower()`; return it joined with `·` (lowercase). Else `None`.

- [ ] **Step 4: Run tests until green.**

- [ ] **Step 5: Wire into `build.py`.** In `collect`, compute per entry the American IPA (Step 1) and the Wiktionary parts (`entry.get('hyphenations', [])[0]['parts']` if present). In `merge`, use the IPA from the first part that has one (same order as today) and set `record['s'] = syllables(...)` and `record['say'] = respell(...)` when not `None`; stop writing `record['ipa']`. Extend `check()` so `agriculture` has `s == 'ag·ri·cul·ture'` and `say == 'AG-rih-kul-cher'`, and every record with `s` satisfies the spell-back rule. Print coverage: count of records with `s`, with `say`, and the share of `commonWords`-style words (use the REQUIRED set plus a sample of 20 printed `word -> s | say` rows from rank 1000-1100) so the controller can eyeball quality.

- [ ] **Step 6: Rebuild shards** with the build command from Global Constraints, then `npx vitest run src/lib/api/dict-data.test.ts`. If that test asserts on `ipa`, update it to the new fields and add assertions: when `s` exists it spells the key (case-insensitive) without `·`; when `say` exists it matches `/^[a-z]+(-[a-z]+)*$/i` and has exactly one all-uppercase syllable; `agriculture` has both expected values.

- [ ] **Step 7: Commit** in logical commits (pron module + tests + requirements; build.py wiring; regenerated shards).

### Task 2: Show it in the app

**Files:**

- Modify: `src/lib/types/dictionary.ts`, `src/lib/api/dictionary.ts`, `src/lib/api/dictionary.test.ts`, `src/lib/components/WordResult.svelte`, `src/lib/components/PhoneticPlayer.svelte`, `tests/e2e/search.spec.ts`, README/CLAUDE.md data-format notes if they mention IPA.

**Interfaces consumed:** shard fields `s?: string`, `say?: string` (Task 1); `ipa` gone.

- [ ] **Step 1: Types.** `ShardEntry`: remove `ipa`, add `s?: string` and `say?: string` with doc comments. `DictionaryEntry`: remove `phonetics` (and the now-unused `Phonetic` type if nothing else uses it), add `syllables?: string` and `sayIt?: string`.
- [ ] **Step 2: Failing unit tests** in `dictionary.test.ts`: `toEntry('agriculture', { s: 'ag·ri·cul·ture', say: 'AG-rih-kul-cher', m: [...] })` yields `syllables` and `sayIt`; an entry without them has neither key. Fix any existing test that referenced `phonetics`/`ipa`.
- [ ] **Step 3: `toEntry`** maps `s`→`syllables`, `say`→`sayIt` (only when present).
- [ ] **Step 4: `WordResult.svelte`.** Under the `<h2>` word, when present show the syllables (e.g. `ag·ri·cul·ture`) in muted text with `aria-label="Syllables: ag, ri, cul, ture"`; then a line `Say it: AG-rih-kul-cher` (label in muted text, respelling in bold) followed by the existing Listen button. If `sayIt` is missing, the Listen button still shows on its own. Keep AAA contrast tokens (`text-text-muted` etc.) and mobile layout (wraps, no horizontal scroll).
- [ ] **Step 5: `PhoneticPlayer.svelte`.** Only consider voices with `localService === true` and `lang` starting with `en`; prefer one whose `lang` is `en-US`. Show the button only when such a voice exists; set `utterance.voice` to the chosen voice (and keep `lang='en-US'`, `rate=0.9`). Add a short code comment: cloud voices would send the word off the device.
- [ ] **Step 6: e2e.** In `search.spec.ts` add a test: search `agriculture` → visible text `ag·ri·cul·ture` and `AG-rih-kul-cher`. The accessibility spec must still pass with axe.
- [ ] **Step 7: Verify** `npx vitest run`, `npm run check`, lint, `npx playwright test`; all pass. Commit (types+lookup; UI; e2e).
