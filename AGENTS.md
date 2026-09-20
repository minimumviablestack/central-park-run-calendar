# AGENTS.md

Guidance for AI coding agents (Claude Code, and others) working in this repository.

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

**Central constraint: this is a strictly static site** — no backend, no server, no database. Never suggest adding one; the project is intentionally static.

Data flow: `scripts/crawlEventsSmart.js` → `data/events.csv` → React app fetches CSV at runtime via `fetch('/data/events.csv')` + PapaParse → UI renders. Do not bypass this flow with live API calls for event data unless explicitly requested.

The build step (`react-scripts build && cp -r data build/`) is critical — without the copy, production has no event data.

### App Structure

- **`src/App.js`** — MUI theme (park green `#2e7d32`), React Router routes (`/` and `/about`)
- **`src/components/EventList.js`** — Main page; owns all state, fetches CSV, orchestrates child components. Mobile shows two tabs (Overview / Plan); desktop shows full layout.
- **`src/hooks/`** — `useWeather` (NWS API), `useAirQuality`, `useSettings` (localStorage)
- **`src/utils/`** — Pure business logic: `routeEngine.js` (route suggestion), `eventRouteMapping.js` (event location → park segment), `bestWindow.js`, `sunCalc.js`, `weatherUtils.js`, `calendarExport.js`
- **`src/data/segments.json`** — Park topology: 8 named segments + pre-computed loops (Full Loop 6.03mi, Lower Loop, Upper Loop, etc.)
- **`scripts/`** — Node.js data-collection scripts (`crawlEventsSmart.js`, `extractGeometry.js`) and shared `lib/`

### Route Planner

`suggestRoutes(targetMi, toleranceMi, affectedSegmentIds)` in `routeEngine.js` returns ranked loop combinations. `eventRouteMapping.js` maps event locations to segment IDs so affected routes get warning badges.

### CI/CD

`.github/workflows/update-events.yml` runs weekly (Mondays 00:00 UTC): crawls events, builds, deploys to `gh-pages` branch. The `deploy-only.yml` workflow handles deploys without a data update.

## Code Conventions

### Formatting & Style
- **Styling**: MUI components + `sx` prop first; Emotion `styled` for complex cases
- **Dates**: `dayjs` only (not native `Date`)
- **Strings**: single quotes in JS, double quotes in JSX attributes
- **Scripts (`scripts/`)**: CommonJS `require()`; app (`src/`): ES6 `import`/`export`
- **Async**: `async/await` with `try/catch`

### Naming
- **React Components**: `PascalCase` (e.g., `EventCard.js`)
- **Functions & Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Import Order
1. React and core React hooks
2. Third-party libraries (MUI, `dayjs`, `papaparse`, etc.)
3. Local components
4. Local hooks and utilities
5. Assets and styles

### UI Guidelines
- Prefer MUI components over custom HTML/CSS; check MUI docs before building a custom component.
- Ensure ARIA labels and keyboard navigability.
- Test UI changes on mobile viewports (this app is mobile-first — runners check it on their phones).

### Data Integrity
- Manual or scripted edits to `data/events.csv` must preserve the existing column structure and date formats.
- Validate CSV-parsed data before passing it to React components to prevent runtime crashes.

### Error Handling & Logging
- **Frontend**: Use MUI `Alert`/`Snackbar` for user-facing errors; avoid raw `alert()`. If the CSV fails to load, show a helpful message with a retry option.
- **Scripts**: Use `console.error`; ensure crawler errors never leave `events.csv` corrupted.

### Testing
- Write unit tests for utility functions and hooks; use React Testing Library for component behavior.
- Mock external dependencies (`papaparse`, `dayjs`) where needed for determinism.
- Prioritize coverage on date parsing and event filtering — the app's core logic.

## Environment

`.env` with `OPENAI_API_KEY` is only needed for `npm run crawl` (not `crawl:smart`). Never commit it.

## Agent Working Files

Keep scratch/intermediate files (exploration scripts, one-off notes, diffs) inside the repo under `.claude/tmp/` (gitignored) rather than under paths outside the project (e.g. `~/.claude/jobs/.../tmp`). Files outside the repo require extra permission grants and accumulate as stale entries in `.claude/settings.local.json`; files under `.claude/tmp/` stay local to this project and don't need parent-directory access.
