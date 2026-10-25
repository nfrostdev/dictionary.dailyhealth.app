# Kids Dictionary

A free, privacy-respecting dictionary web application for Elementary school children. Look up any word to see its definition, pronunciation, and examples.

**Live at**: [dictionary.dailyhealth.app](https://dictionary.dailyhealth.app)

## Features

- **Simple search** — Type a word, see its definition, pronunciation (with audio), synonyms, and examples
- **Spell suggestions** — Misspell a word? Get "Did you mean...?" suggestions powered by fuzzy matching
- **Dark/light mode** — System-aware theme with manual toggle, persisted in localStorage
- **PWA** — Installable as an app, with offline support for previously searched words
- **Privacy-first** — No cookies, no analytics, no tracking, no third-party scripts
- **Accessible** — WCAG AAA compliant: 7:1+ contrast ratios, keyboard navigation, screen reader support, skip navigation

## Tech Stack

- [SvelteKit](https://svelte.dev/) (Svelte 5) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4
- Word data from [English Wiktionary](https://en.wiktionary.org/) via [kaikki.org](https://kaikki.org/), bundled as static files
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + [axe-core](https://github.com/dequelabs/axe-core)

## Dictionary data

Definitions live in `static/dict/`, one JSON file per three-letter prefix (`hel.json` holds "hello", "helmet", …), so a lookup downloads a few KB and works offline once cached. The files are generated, not hand-edited. To rebuild from the latest Wiktionary dump (3.4 GB, streamed, ~5 minutes):

```sh
python3 -m venv .venv-dict
.venv-dict/bin/pip install -r scripts/dict/requirements.txt
curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
  | .venv-dict/bin/python -I scripts/dict/build.py - static/dict
node scripts/dict/prune.ts static/dict
npx vitest run src/lib/api/dict-data.test.ts
```

The build keeps the 100,000 most common English words (by [wordfreq](https://github.com/rspeer/wordfreq)), drops senses Wiktionary tags as vulgar, offensive, slang, archaic and similar, and keeps up to three senses per part of speech. `prune.ts` then runs the app's own content filter over the built shards, so blocked words and filtered senses never ship; the same filter still runs at lookup time.

### License

The dictionary data in `static/dict/` is derived from English Wiktionary and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Development

```sh
npm install
npm run dev
```

## Testing

```sh
# Unit tests
npx vitest run

# E2E tests (requires Playwright browsers)
npx playwright install chromium
npx playwright test

# All tests
npm test
```

## Building

```sh
npm run build
npm run preview  # Preview with Wrangler
```

## Deployment

Deployed automatically to Cloudflare Pages on push to `main`. Build command: `npm run build`, output directory: `.svelte-kit/cloudflare`.
