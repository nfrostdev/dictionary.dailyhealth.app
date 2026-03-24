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
- [Free Dictionary API](https://dictionaryapi.dev/)
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + [axe-core](https://github.com/dequelabs/axe-core)

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
