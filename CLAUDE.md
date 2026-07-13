# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                        # Dev server at localhost:3000
npm test                         # Run Jest test suite (src/, non-watch)
npm test -- src/path/to/file.js  # Run single test file
npm run test:scripts             # Run node --test suite for scripts/lib/
npm run crawl:smart              # Update events.csv using NYC Open Data API (recommended)
npm run crawl                    # Update events.csv using OpenAI GPT-4o (requires OPENAI_API_KEY)
npm run build                    # Production build (also copies data/ to build/)
npm run deploy                   # Deploy build/ to GitHub Pages
```

## Architecture

**Central constraint: this is a strictly static site** — no backend, no server, no database.

Data flow: `scripts/crawlEventsSmart.js` → `data/events.csv` → React app fetches CSV at runtime via `fetch('/data/events.csv')` + PapaParse → UI renders.

The build step (`react-scripts build && cp -r data build/`) is critical — without the copy, production has no event data.

### App Structure

- **`src/App.js`** — MUI theme (park green `#2e7d32`), React Router routes (`/` and `/about`)
- **`src/components/EventList.js`** — Main page; owns all state, fetches CSV, orchestrates child components. Mobile shows two tabs (Overview / Plan); desktop shows full layout.
- **`src/hooks/`** — `useWeather` (NWS API), `useAirQuality`, `useSettings` (localStorage)
- **`src/utils/`** — Pure business logic: `routeEngine.js` (route suggestion), `eventRouteMapping.js` (event location → park segment), `bestWindow.js`, `sunCalc.js`, `weatherUtils.js`, `calendarExport.js`
- **`src/data/segments.json`** — Park topology: 8 named segments + pre-computed loops (Full Loop 6.03mi, Lower Loop, Upper Loop, etc.)

### Route Planner

`suggestRoutes(targetMi, toleranceMi, affectedSegmentIds)` in `routeEngine.js` returns ranked loop combinations. `eventRouteMapping.js` maps event locations to segment IDs so affected routes get warning badges.

### CI/CD

`.github/workflows/update-events.yml` runs weekly (Mondays 00:00 UTC): crawls events, builds, deploys to `gh-pages` branch. The `deploy-only.yml` workflow handles deploys without a data update.

## Code Conventions

- **Styling**: MUI components + `sx` prop first; Emotion `styled` for complex cases
- **Dates**: `dayjs` only (not native `Date`)
- **Strings**: single quotes in JS, double quotes in JSX attributes
- **Scripts (`scripts/`)**: CommonJS `require()`; app (`src/`): ES6 `import`/`export`
- **Async**: `async/await` with `try/catch`

## Environment

`.env` with `OPENAI_API_KEY` is only needed for `npm run crawl` (not `crawl:smart`). Never commit it.
