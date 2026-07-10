# Data Scope + Daily CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the crawler capture only route-impacting Central Park events (races, parades, bike events, drive-closing gatherings, film shoots), tag every event with its SOURCE, and refresh data daily instead of weekly.

**Architecture:** Extract pure, testable logic into `scripts/lib/` CommonJS modules (route-impact classification, dedup, film-permit transform) shared-data-driven by a new `src/data/locationSegments.json` that both the React app and the crawler read. The crawler (`scripts/crawlEventsSmart.js`) keeps its per-source fetchers but delegates filtering/dedup to the new modules. CI cron goes daily.

**Tech Stack:** Node CommonJS scripts, `node --test` (Node ≥ 20 built-in test runner) for `scripts/`, CRA Jest for `src/`, Socrata Open Data API (axios), GitHub Actions.

## Global Constraints

- Strictly static site: no backend, no server, no database (spec).
- `scripts/` use CommonJS `require()`; `src/` uses ES6 `import`/`export` (CLAUDE.md).
- Single quotes in JS, double quotes in JSX attributes (CLAUDE.md).
- `dayjs` only for dates in `src/`; scripts may use plain string parsing (existing pattern).
- Never commit `.env` (CLAUDE.md).
- Existing rows in `data/events.csv` are preserved by the crawler's merge logic — do not delete historical events.
- Known repo quirk: `package.json` currently has **no `test` script** and Jest is broken because `react-router-dom@7.3.0` declares `main: ./dist/main.js` which does not exist in the package. Task 1 fixes both; every later task assumes `npm test` and `npm run test:scripts` work.

---

### Task 1: Repair the test harness

The repo has one stale test (`src/App.test.js`, default CRA "learn react link" — that text no longer exists) and no `test` script. Running Jest fails with `Cannot find module 'react-router-dom' from 'src/App.js'` because `react-router-dom@7.3.0` ships a `main` field pointing at a missing file; Jest 27 (CRA 5) ignores the `exports` map. The real CJS build exists at `node_modules/react-router-dom/dist/index.js` (verified).

**Files:**
- Modify: `package.json` (add `test`, `test:scripts` scripts; add `jest.moduleNameMapper`)
- Modify: `src/App.test.js` (replace stale test with a smoke test)
- Create if missing: `src/setupTests.js`
- Modify: `CLAUDE.md` (document the two test commands)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (CRA Jest, non-watch) and `npm run test:scripts` (`node --test scripts/lib/`) — every later task's verify steps use these exact commands.

- [ ] **Step 1: Add test scripts and Jest module mapping to package.json**

In `package.json`, change the `scripts` block to:

```json
"scripts": {
  "start": "react-scripts start",
  "test": "react-scripts test --watchAll=false",
  "test:scripts": "node --test scripts/lib/",
  "crawl": "node scripts/crawlEvents.js",
  "crawl:smart": "node scripts/crawlEventsSmart.js",
  "build": "CI=false react-scripts build && cp -r data build/",
  "deploy": "gh-pages -d build"
},
```

And add a top-level `jest` key (sibling of `scripts`):

```json
"jest": {
  "moduleNameMapper": {
    "^react-router-dom$": "<rootDir>/node_modules/react-router-dom/dist/index.js"
  }
},
```

- [ ] **Step 2: Ensure src/setupTests.js exists**

If `src/setupTests.js` does not exist, create it with exactly:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Replace the stale App test with a smoke test**

Replace the entire contents of `src/App.test.js` with:

```js
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('EVENT_NAME,DATE,START_TIME,END_TIME,LOCATION,DESCRIPTION,URL\n'),
      json: () => Promise.resolve({}),
    })
  );
});

test('renders the app tagline', async () => {
  render(<App />);
  expect(
    await screen.findByText(/should i run in central park today/i)
  ).toBeInTheDocument();
});
```

(The tagline "Should I run in Central Park today?" is static text in `src/components/EventList.js:137`. The fetch mock satisfies the CSV fetch in `EventList.js:59` and the weather/AQI hooks, whose failures are already caught in try/catch.)

- [ ] **Step 4: Run the suite and verify it passes**

Run: `npm test`
Expected: `Tests: 1 passed, 1 total`. If a jsdom API is reported missing (e.g. `window.matchMedia`), add a stub to `src/setupTests.js` beneath the import:

```js
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}
```

- [ ] **Step 5: Document commands in CLAUDE.md**

In `CLAUDE.md`'s Commands block, replace the two test lines with:

```bash
npm test                         # Run Jest test suite (src/, non-watch)
npm test -- src/path/to/file.js  # Run single test file
npm run test:scripts             # Run node --test suite for scripts/lib/
```

- [ ] **Step 6: Commit**

```bash
git add package.json src/App.test.js src/setupTests.js CLAUDE.md
git commit -m "test: repair jest harness (react-router-dom main-field bug), add test scripts"
```

---

### Task 2: Shared location→segment data file

The location→segment patterns live only in `src/utils/eventRouteMapping.js`. The crawler's new route-impact filter (Task 3) needs the same patterns. Move them to a JSON file both sides read.

**Files:**
- Create: `src/data/locationSegments.json`
- Modify: `src/utils/eventRouteMapping.js`
- Test: `src/utils/eventRouteMapping.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/data/locationSegments.json` with shape `{ "allDriveSegments": string[], "mappings": [{ "patterns": string[], "segments": string[] }] }`. Exports of `eventRouteMapping.js` are unchanged: `mapEventToSegments(event) → string[]`, `getAffectedSegments(todayEvents) → string[]`.

- [ ] **Step 1: Write the characterization test (protects the refactor)**

Create `src/utils/eventRouteMapping.test.js`:

```js
import { mapEventToSegments, getAffectedSegments } from './eventRouteMapping';

const ALL_DRIVES = [
  'drive_south',
  'drive_east_mid',
  'drive_north',
  'drive_west_mid',
  'transverse_72',
  'transverse_102',
];

test('generic Central Park location maps to all drive segments', () => {
  expect(mapEventToSegments({ LOCATION: 'Central Park' }).sort()).toEqual(
    [...ALL_DRIVES].sort()
  );
});

test('East Drive location maps to drive_east_mid', () => {
  expect(mapEventToSegments({ LOCATION: 'East Drive at 90th St' })).toContain(
    'drive_east_mid'
  );
});

test('reservoir location maps only to reservoir', () => {
  expect(mapEventToSegments({ LOCATION: 'JKO Reservoir' })).toEqual(['reservoir']);
});

test('unknown specific location falls back to all drives', () => {
  expect(mapEventToSegments({ LOCATION: 'Some Unknown Place' }).sort()).toEqual(
    [...ALL_DRIVES].sort()
  );
});

test('getAffectedSegments unions segments across events', () => {
  const events = [
    { LOCATION: 'JKO Reservoir' },
    { LOCATION: 'Bridle Path' },
  ];
  expect(getAffectedSegments(events).sort()).toEqual(['bridle_path', 'reservoir']);
});
```

- [ ] **Step 2: Run it against the current implementation**

Run: `npm test -- src/utils/eventRouteMapping.test.js`
Expected: PASS (5 tests) — this is a refactor guard, so it must pass before and after.

- [ ] **Step 3: Create the shared JSON**

Create `src/data/locationSegments.json` (content is the table from `eventRouteMapping.js:1-15`, verbatim):

```json
{
  "allDriveSegments": [
    "drive_south",
    "drive_east_mid",
    "drive_north",
    "drive_west_mid",
    "transverse_72",
    "transverse_102"
  ],
  "mappings": [
    { "patterns": ["72nd", "terrace drive", "bethesda"], "segments": ["transverse_72", "drive_south", "drive_east_mid"] },
    { "patterns": ["102nd", "connecting drive"], "segments": ["transverse_102", "drive_north", "drive_east_mid"] },
    { "patterns": ["harlem hill", "harlem meer", "110th", "warriors gate", "north end"], "segments": ["drive_north"] },
    { "patterns": ["cat hill", "engineers gate", "90th", "metropolitan", "east drive"], "segments": ["drive_east_mid"] },
    { "patterns": ["great hill", "west drive", "summit rock", "north meadow"], "segments": ["drive_west_mid"] },
    { "patterns": ["columbus circle", "tavern on the green", "59th", "sheep meadow", "south end"], "segments": ["drive_south"] },
    { "patterns": ["reservoir", "jko", "jacqueline"], "segments": ["reservoir"] },
    { "patterns": ["bridle path"], "segments": ["bridle_path"] }
  ]
}
```

- [ ] **Step 4: Refactor eventRouteMapping.js to read the JSON**

Replace the entire contents of `src/utils/eventRouteMapping.js` with:

```js
import locationSegments from '../data/locationSegments.json';

const LOCATION_TO_SEGMENTS = locationSegments.mappings;
const ALL_DRIVE_SEGMENTS = locationSegments.allDriveSegments;

export const mapEventToSegments = (event) => {
  const location = (event.LOCATION || '').toLowerCase();

  if (!location || location === 'central park' || location === 'central park, new york') {
    return ALL_DRIVE_SEGMENTS;
  }

  const matched = new Set();
  for (const mapping of LOCATION_TO_SEGMENTS) {
    for (const pattern of mapping.patterns) {
      if (location.includes(pattern)) {
        mapping.segments.forEach(s => matched.add(s));
      }
    }
  }

  return matched.size > 0 ? Array.from(matched) : ALL_DRIVE_SEGMENTS;
};

export const getAffectedSegments = (todayEvents) => {
  const affected = new Set();
  for (const event of todayEvents) {
    mapEventToSegments(event).forEach(s => affected.add(s));
  }
  return Array.from(affected);
};
```

- [ ] **Step 5: Verify tests still pass**

Run: `npm test -- src/utils/eventRouteMapping.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/locationSegments.json src/utils/eventRouteMapping.js src/utils/eventRouteMapping.test.js
git commit -m "refactor: move location->segment patterns to shared JSON data file"
```

---

### Task 3: Route-impact classifier

Pure CommonJS module deciding whether an event occupies runnable segments. Replaces the three divergent inline keyword filters in the crawler (wired in Task 5).

**Files:**
- Create: `scripts/lib/routeImpact.js`
- Test: `scripts/lib/routeImpact.test.js`

**Interfaces:**
- Consumes: `src/data/locationSegments.json` (Task 2 shape).
- Produces: `module.exports = { isRouteImpacting }` where `isRouteImpacting(event: { name, location, description }) → boolean`. Task 5 calls it on every crawled event.

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/routeImpact.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { isRouteImpacting } = require('./routeImpact');

test('NYRR race is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'NYRR Joe Kleinerman 10K',
    location: 'Central Park',
    description: 'NYRR Race'
  }), true);
});

test('bike race with generic park location is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Grand Prix Bike Race',
    location: 'Central Park',
    description: 'Cycling event'
  }), true);
});

test('parade with empty location is route-impacting (parades use the drives)', () => {
  assert.equal(isRouteImpacting({
    name: 'Heritage Parade',
    location: '',
    description: 'Annual parade'
  }), true);
});

test('film shoot on the park is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Film shoot: Television',
    location: 'Central Park (film shoot)',
    description: 'Shooting Permit - Television'
  }), true);
});

test('concert explicitly on a drive is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Summer Concert',
    location: 'East Drive at 90th St',
    description: 'Concert'
  }), true);
});

test('Great Lawn concert without drive mention is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'SummerStage Concert',
    location: 'Great Lawn',
    description: 'Concert'
  }), false);
});

test('museum event is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Museum Mile Festival',
    location: 'Fifth Avenue',
    description: 'Museum open house'
  }), false);
});

test('birdwalk is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Saturday Birdwalk',
    location: 'The Ramble',
    description: 'Guided birdwalk'
  }), false);
});

test('playground event is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Family Day',
    location: 'Heckscher Playground',
    description: 'Kids activities'
  }), false);
});

test('lawn closure is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Sheep Meadow Lawn Closure',
    location: 'Sheep Meadow',
    description: 'Lawn closure'
  }), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:scripts`
Expected: FAIL — `Cannot find module './routeImpact'`.

- [ ] **Step 3: Implement the classifier**

Create `scripts/lib/routeImpact.js`:

```js
const locationSegments = require('../../src/data/locationSegments.json');

const RUNNING_KEYWORDS = [
  'run', 'race', 'marathon', 'triathlon', 'duathlon',
  '5k', '10k', 'half', 'relay', 'miler'
];
const DRIVE_EVENT_KEYWORDS = [
  'bike', 'cycling', 'parade', 'march', 'walkathon', 'walk-a-thon', 'charity walk'
];
const LARGE_GATHERING_KEYWORDS = ['concert', 'festival', 'rally'];
const EXCLUDE_KEYWORDS = [
  'museum', 'playground', 'birding', 'bird walk', 'birdwalk',
  'storytime', 'story time', 'lawn closure', 'nature walk', 'gallery'
];

const segmentPatterns = locationSegments.mappings.flatMap((m) => m.patterns);

function isRouteImpacting(event) {
  const name = (event.name || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const loc = (event.location || '').toLowerCase();
  const text = `${name} ${desc}`;

  if (EXCLUDE_KEYWORDS.some((kw) => text.includes(kw))) return false;

  if (RUNNING_KEYWORDS.some((kw) => text.includes(kw))) return true;

  // Non-running events confined to lawns/playgrounds never block the loop
  if (loc.includes('lawn') || loc.includes('playground')) return false;

  const onSegment = segmentPatterns.some((p) => loc.includes(p));
  const genericPark = loc === '' || loc.includes('central park');

  const isDriveEvent = DRIVE_EVENT_KEYWORDS.some((kw) => text.includes(kw));
  const isFilmShoot = text.includes('shooting permit') || text.includes('film shoot');
  if (isDriveEvent || isFilmShoot) return onSegment || genericPark;

  // Concerts/festivals only count when they explicitly sit on a drive
  if (LARGE_GATHERING_KEYWORDS.some((kw) => text.includes(kw))) return onSegment;

  return false;
}

module.exports = { isRouteImpacting };
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:scripts`
Expected: `pass 10` / `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/routeImpact.js scripts/lib/routeImpact.test.js
git commit -m "feat: add route-impact classifier for crawler event filtering"
```

---

### Task 4: Dedup module with cross-source name normalization

The crawler's dedup key is raw `name_date`, so "NYRR Mini 10K" and "New York Mini 10K" on the same date survive as duplicates once multiple sources report the same race. Extract dedup into a tested module with a normalized key.

**Files:**
- Create: `scripts/lib/events.js`
- Test: `scripts/lib/events.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `module.exports = { normalizeEventKey, deduplicateEvents }`; `normalizeEventKey(event: { name, date }) → string`; `deduplicateEvents(events) → events` (keeps the entry with the longer description per key). Task 5 replaces the crawler's local `deduplicateEvents` with this one.

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/events.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { normalizeEventKey, deduplicateEvents } = require('./events');

test('normalizeEventKey strips filler words and punctuation', () => {
  assert.equal(
    normalizeEventKey({ name: 'NYRR Mini 10K', date: '2026-06-13' }),
    normalizeEventKey({ name: 'New York Mini 10K!', date: '2026-06-13' })
  );
});

test('normalizeEventKey keeps different dates distinct', () => {
  assert.notEqual(
    normalizeEventKey({ name: 'Mini 10K', date: '2026-06-13' }),
    normalizeEventKey({ name: 'Mini 10K', date: '2027-06-12' })
  );
});

test('deduplicateEvents keeps the entry with the longer description', () => {
  const result = deduplicateEvents([
    { name: 'NYRR Mini 10K', date: '2026-06-13', description: 'Race', source: 'nyrr' },
    { name: 'New York Mini 10K', date: '2026-06-13', description: 'Historic women-only 10K', source: 'nyc-parks' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].description, 'Historic women-only 10K');
  assert.equal(result[0].source, 'nyc-parks');
});

test('deduplicateEvents leaves distinct events alone', () => {
  const result = deduplicateEvents([
    { name: 'Race A', date: '2026-06-13', description: '' },
    { name: 'Race B', date: '2026-06-13', description: '' },
  ]);
  assert.equal(result.length, 2);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:scripts`
Expected: FAIL — `Cannot find module './events'` (routeImpact tests still pass).

- [ ] **Step 3: Implement**

Create `scripts/lib/events.js`:

```js
function normalizeEventKey(event) {
  const name = (event.name || '')
    .toLowerCase()
    .replace(/\b(nyrr|nycruns|nyc|new york)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `${name}_${event.date}`;
}

function deduplicateEvents(events) {
  const unique = new Map();

  events.forEach((event) => {
    const key = normalizeEventKey(event);
    const existing = unique.get(key);
    if (!existing || (existing.description || '').length < (event.description || '').length) {
      unique.set(key, event);
    }
  });

  return Array.from(unique.values());
}

module.exports = { normalizeEventKey, deduplicateEvents };
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:scripts`
Expected: all tests pass (routeImpact 10 + events 4).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/events.js scripts/lib/events.test.js
git commit -m "feat: add tested dedup module with cross-source name normalization"
```

---

### Task 5: Wire the crawler — SOURCE column, central filter, re-enabled Open Data

Replace the crawler's three inline keyword filters with `isRouteImpacting`, tag every event with a source, re-enable the NYC Open Data permitted-events feed (it was skipped because it returned lawn closures — the new classifier handles that), and use the shared dedup.

**Files:**
- Modify: `scripts/crawlEventsSmart.js`

**Interfaces:**
- Consumes: `isRouteImpacting` (Task 3), `deduplicateEvents` (Task 4).
- Produces: `data/events.csv` gains a `SOURCE` column with values `manual | nyc-open-data | nyc-parks | nyrr | nycruns` (Task 6 adds `film-permits`). The React app reads the CSV by header name via PapaParse, so the extra column is backward compatible.

- [ ] **Step 1: Import the new modules**

At the top of `scripts/crawlEventsSmart.js`, after the existing requires, add:

```js
const { isRouteImpacting } = require('./lib/routeImpact');
const { deduplicateEvents } = require('./lib/events');
```

Then delete the local `deduplicateEvents` function (lines 117–130 in the current file).

- [ ] **Step 2: Add SOURCE to the CSV writer**

In the `csvWriter` header array, add as the last entry:

```js
{ id: 'source', title: 'SOURCE' }
```

- [ ] **Step 3: Preserve SOURCE when reading existing events**

In `readExistingEvents`, extend the constructed event object with:

```js
source: data.SOURCE || 'manual',
```

- [ ] **Step 4: Tag each fetcher's events and remove inline filters**

1. `fetchNYCOpenDataEvents`: delete the `runningKeywords`/`largeEventKeywords` filtering block (the `filteredEvents` computation) and map over `allEvents` directly; add `source: 'nyc-open-data'` to the returned object.
2. `fetchNYCParksEventsStructured`: in the final `.map`, add `source: 'nyc-parks'` to the returned object.
3. `fetchNYRREventsWithDetailPages`: in the `centralParkEvents` map, add `source: 'nyrr'`.
4. In `main()`, where NYCRUNS LLM events are appended, map them first: `filteredEvents.map(e => ({ ...e, source: 'nycruns' }))`.

- [ ] **Step 5: Re-enable Open Data and centralize filtering in main()**

In `main()`:

1. Replace the skipped Open Data block:

```js
console.log('\n--- NYC Open Data API ---');
const openDataEvents = await fetchNYCOpenDataEvents();
console.log(`Got ${openDataEvents.length} events from NYC Open Data API`);
allEvents = [...allEvents, ...openDataEvents];
```

2. Delete the inline NYC Parks filter block (the `runningKeywords`/`largeEventKeywords` declarations and `filteredParksEvents` computation) and append `nycParksEvents` directly.
3. After all sources are collected, apply the central filter — this **replaces** the existing `allEvents = [...existingEvents, ...allEvents];` line:

```js
const impactingEvents = allEvents.filter(isRouteImpacting);
console.log(`Route-impacting events: ${impactingEvents.length} (of ${allEvents.length} crawled)`);

allEvents = [...existingEvents, ...impactingEvents];
```

(Existing CSV rows bypass the filter so history is preserved.)

- [ ] **Step 6: Integration check — run the crawler**

Run: `node scripts/crawlEventsSmart.js` (no `OPENAI_API_KEY` needed; the LLM source skips itself).
Expected: completes without error; console shows per-source counts and the "Route-impacting events" line.

Then run: `head -3 data/events.csv`
Expected: header ends with `,SOURCE`; pre-existing rows show `manual`.

Then run: `npm test && npm run test:scripts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/crawlEventsSmart.js data/events.csv public/data/events.csv
git commit -m "feat: route-impact filtering, SOURCE column, re-enable NYC Open Data source"
```

---

### Task 6: Film-permit source

NYC Open Data "Film Permits" dataset (`tad4-ftjs`) lists shoots with a `parkingheld` street description. **Trap:** "CENTRAL PARK WEST" is an avenue, not the park — a naive `LIKE '%CENTRAL PARK%'` floods results with CPW parking holds. The transform must strip `CENTRAL PARK WEST` before matching.

**Files:**
- Create: `scripts/lib/filmPermits.js`
- Test: `scripts/lib/filmPermits.test.js`
- Modify: `scripts/crawlEventsSmart.js`

**Interfaces:**
- Consumes: nothing (pure transform + axios in the crawler).
- Produces: `module.exports = { transformFilmPermits, formatSocrataTime }`; `transformFilmPermits(rows) → event[]` where each event has `{ name, date, startTime, endTime, location, description, url, source: 'film-permits' }` — the same shape every other fetcher returns.

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/filmPermits.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { transformFilmPermits, formatSocrataTime } = require('./filmPermits');

test('formatSocrataTime converts to 12-hour format without timezone shifts', () => {
  assert.equal(formatSocrataTime('2026-07-15T06:00:00.000'), '6:00 AM');
  assert.equal(formatSocrataTime('2026-07-15T14:30:00.000'), '2:30 PM');
  assert.equal(formatSocrataTime('2026-07-15T00:15:00.000'), '12:15 AM');
  assert.equal(formatSocrataTime(''), '');
});

test('permits held inside Central Park are transformed', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    category: 'Television',
    startdatetime: '2026-07-15T06:00:00.000',
    enddatetime: '2026-07-15T20:00:00.000',
    parkingheld: 'WEST DRIVE (CENTRAL PARK) between TERRACE DRIVE and 72 STREET',
  }];
  const events = transformFilmPermits(rows);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'Film shoot: Television');
  assert.equal(events[0].date, '2026-07-15');
  assert.equal(events[0].startTime, '6:00 AM');
  assert.equal(events[0].endTime, '8:00 PM');
  assert.equal(events[0].source, 'film-permits');
});

test('Central Park West avenue permits are excluded', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    category: 'Film',
    startdatetime: '2026-07-15T06:00:00.000',
    parkingheld: 'CENTRAL PARK WEST between W 81 ST and W 84 ST',
  }];
  assert.equal(transformFilmPermits(rows).length, 0);
});

test('rows without startdatetime are excluded', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    parkingheld: 'WEST DRIVE (CENTRAL PARK)',
  }];
  assert.equal(transformFilmPermits(rows).length, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:scripts`
Expected: FAIL — `Cannot find module './filmPermits'`.

- [ ] **Step 3: Implement**

Create `scripts/lib/filmPermits.js`:

```js
function formatSocrataTime(dt) {
  if (!dt || dt.length < 16) return '';
  const [h, m] = dt.slice(11, 16).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function isInsideCentralPark(parkingheld) {
  const held = (parkingheld || '').toUpperCase().replace(/CENTRAL PARK WEST/g, '');
  return held.includes('CENTRAL PARK');
}

function transformFilmPermits(rows) {
  return rows
    .filter((r) => r.startdatetime && isInsideCentralPark(r.parkingheld))
    .map((r) => ({
      name: `Film shoot: ${r.category || 'Production'}`,
      date: r.startdatetime.split('T')[0],
      startTime: formatSocrataTime(r.startdatetime),
      endTime: r.enddatetime ? formatSocrataTime(r.enddatetime) : '',
      location: 'Central Park (film shoot)',
      description: `${r.eventtype || 'Shooting Permit'} - ${r.category || 'Production'}`,
      url: 'https://data.cityofnewyork.us/City-Government/Film-Permits/tad4-ftjs',
      source: 'film-permits',
    }));
}

module.exports = { transformFilmPermits, formatSocrataTime };
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:scripts`
Expected: all tests pass (routeImpact 10 + events 4 + filmPermits 4).

- [ ] **Step 5: Wire the fetcher into the crawler**

In `scripts/crawlEventsSmart.js`, add to the requires:

```js
const { transformFilmPermits } = require('./lib/filmPermits');
```

Add this function next to the other fetchers:

```js
async function fetchFilmPermits() {
  console.log('Fetching film permits from NYC Open Data...');

  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await axios.get('https://data.cityofnewyork.us/resource/tad4-ftjs.json', {
      params: {
        $where: `startdatetime >= '${today}T00:00:00' AND upper(parkingheld) LIKE '%CENTRAL PARK%'`,
        $order: 'startdatetime ASC',
        $limit: 200
      }
    });
    return transformFilmPermits(response.data);
  } catch (error) {
    console.error('Error fetching film permits:', error.message);
    return [];
  }
}
```

In `main()`, after the Open Data block, add:

```js
console.log('\n--- Film Permits (NYC Open Data) ---');
const filmEvents = await fetchFilmPermits();
console.log(`Got ${filmEvents.length} Central Park film permits`);
allEvents = [...allEvents, ...filmEvents];
```

(No extra filtering needed — `isRouteImpacting` in `main()` already passes film shoots through its film-shoot branch.)

- [ ] **Step 6: Integration check**

Run: `node scripts/crawlEventsSmart.js`
Expected: the Film Permits section logs a count (0 is valid — shoots inside the park are rare); no errors; CSV rows with `film-permits` source only if permits exist.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/filmPermits.js scripts/lib/filmPermits.test.js scripts/crawlEventsSmart.js data/events.csv public/data/events.csv
git commit -m "feat: add Central Park film-permit source (excludes Central Park West avenue)"
```

---

### Task 7: Daily CI builds

**Files:**
- Modify: `.github/workflows/update-events.yml:4-5`
- Modify: `CLAUDE.md` (CI/CD section)

**Interfaces:**
- Consumes: nothing.
- Produces: daily refreshed `gh-pages` deployment (data, and later the .ics feed and JSON-LD from other plans, all ride this schedule).

- [ ] **Step 1: Change the cron**

In `.github/workflows/update-events.yml`, replace:

```yaml
  schedule:
    - cron: '0 0 * * 1'  # Run weekly on Mondays at midnight
```

with:

```yaml
  schedule:
    - cron: '0 8 * * *'  # Run daily at 08:00 UTC (~3-4am New York) so data is fresh before morning runs
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`'s CI/CD section, replace "runs weekly (Mondays 00:00 UTC)" with "runs daily (08:00 UTC)".

- [ ] **Step 3: Commit and verify the workflow parses**

```bash
git add .github/workflows/update-events.yml CLAUDE.md
git commit -m "ci: crawl and deploy daily instead of weekly"
```

After the branch is pushed/merged, trigger once manually (`gh workflow run update-events.yml`) and confirm a green run — this validates the workflow file and that the reworked crawler behaves in CI.

---

## Deviation from spec (flagged for owner)

The spec lists the **Central Park Conservancy calendar** as a source. This plan defers it: Conservancy events that actually close drives require NYC permits and therefore already appear in the permitted-events dataset (Task 5); the rest of their calendar is overwhelmingly non-route-impacting (birdwalks, tours, volunteer days) that the classifier would discard. Scraping their JS-heavy calendar adds fragility for near-zero new signal. Revisit if real closures are observed missing from the CSV.
