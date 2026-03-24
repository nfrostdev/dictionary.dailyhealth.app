# CLAUDE.md

## Project Overview

Kids Dictionary — a free, privacy-respecting dictionary PWA for Elementary school children (ages 5-11). Single-page search app that looks up words via the free dictionaryapi.dev API.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (Cloudflare Pages adapter)
- `npm run preview` — Preview with Wrangler
- `npm run check` — Svelte type checking
- `npm run lint` — ESLint + Prettier check
- `npm run format` — Auto-format with Prettier
- `npx vitest run` — Run unit tests
- `npx playwright test` — Run E2E tests
- `npm test` — Run all tests (unit + E2E)

## Architecture

- **SvelteKit 2** (Svelte 5 with runes) + TypeScript
- **Tailwind CSS v4** with custom theme tokens in `src/routes/layout.css`
- **Cloudflare Pages** via `@sveltejs/adapter-cloudflare`
- **PWA** via `@vite-pwa/sveltekit` (NetworkFirst API caching, CacheFirst static assets)
- **Single page** — all UI lives in `src/routes/+page.svelte`

## Key Conventions

- Theme colors are CSS custom properties (`--theme-*`) mapped to Tailwind tokens (`bg-surface`, `text-primary`, etc.) in `layout.css`. Button text uses `text-primary-text` (not `text-white`) — it resolves to white in light mode and dark in dark mode for AAA contrast on colored backgrounds.
- Theme store is in `.svelte.ts` file for SSR-safe `$state` runes
- WCAG AAA: 7:1+ contrast, all interactive elements are native HTML, `aria-live` on results region
- Privacy: zero cookies, zero analytics, zero third-party scripts. Only external request is to dictionaryapi.dev
- Spell suggestions use Levenshtein distance against a bundled word list (~5,200 words) — no external dependency
- Kid-friendly copy: simple words, first-grade reading level for UI text

## Testing

- Unit tests: Vitest, colocated as `*.test.ts` next to source files
- E2E tests: Playwright in `tests/e2e/`, uses axe-core for automated accessibility audits
- Vitest config has `requireAssertions: true` — every test must have at least one `expect()`
