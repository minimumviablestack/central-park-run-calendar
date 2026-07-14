# Interactive Route Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Route Planner's hand-sketched, non-rendering map polylines with real road-following geometry, animate route selection like the route is being drawn in, and bring the Route Planner back to desktop (it's currently mobile-only).

**Architecture:** A one-time Overpass API extraction script produces real Central Park path geometry as static JSON, shipped with the app (no runtime network dependency, staying strictly static). `ParkMap.js` is rewritten to consume that geometry instead of hardcoded approximate coordinates, with a Carto Positron basemap and mile-marker/direction-arrow dressing computed by new pure geo-math utilities. A small animation hook progressively reveals the selected route's polyline. `EventList.js` is restructured so desktop shows the map/planner in a persistent sticky column instead of hiding it behind a mobile-only tab.

**Tech Stack:** react-leaflet 5 / leaflet 1.9 (existing deps), Overpass API (OpenStreetMap, free, no key) for one-time geometry extraction, axios (existing dep) for the extraction script, MUI Grid (existing pattern) for layout.

## Global Constraints

- Strictly static site: no backend, no server, no database. Geometry extraction runs once, offline; its output ships as a committed JSON file.
- `scripts/` use CommonJS `require()`; `src/` uses ES6 `import`/`export`.
- Single quotes in JS, double quotes in JSX attributes.
- `dayjs` only for dates in `src/` (not touched by this plan; no new date handling introduced).
- Self-check tolerance for extracted geometry: computed haversine length of each segment must be within **±0.1 mi** of the distance already declared in `src/data/segments.json`.
- Route-draw animation duration: **~1.5s (1500ms)**.
- Tile provider: Carto Positron, `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`, no API key.
- `npm test` (CRA Jest, non-watch) and `npm run test:scripts` (`node --test` over `scripts/lib/`) must both pass after every task — these commands already exist and work (verified: 6/6 and 19/19 passing before this plan starts).
- **Known environment fact, verified empirically, binding on every task that touches map rendering:** Leaflet's vector layers (`Polyline`, `CircleMarker`, `Polygon`, `Circle`) throw `AggregateError: Cannot use 'in' operator to search for '_leaflet_id' in null` when actually mounted in jsdom — this is a jsdom/SVG-renderer limitation, not an app bug (`Marker`, which uses a plain DOM icon, renders fine). Any component test that touches `ParkMap` or anything that imports it **must mock `react-leaflet`** (stub every export used) rather than attempt a real render. Do not "fix" this by trying to render real Leaflet vector layers in tests — it cannot be fixed at the app-code level.
- **Known environment fact, verified empirically:** `window.matchMedia` is `undefined` in this project's jsdom test environment by default, so MUI's `useMediaQuery` falls back to `false` — meaning `isMobile` is `false` unless a test explicitly stubs `window.matchMedia`. Any test needing the mobile branch must install that stub itself (pattern given in Task 5).
- **Known environment fact, verified empirically:** components using `react-router-dom`'s `<Link>` throw `Cannot destructure property 'basename' of 'React.useContext(...)' as it is null` unless rendered inside a Router. `EventList` contains a `<Link>`, so any test rendering it directly (not through `<App />`) must wrap it in `<MemoryRouter>`.
- **Known environment fact, verified empirically:** `requestAnimationFrame` in this jsdom test environment is timer-based and IS advanced by `jest.useFakeTimers()` + `jest.advanceTimersByTime()`. However, the timestamp jsdom passes into the rAF callback is a real epoch-scale number **on a different scale than `performance.now()`** under fake timers — mixing the two inside elapsed-time math silently breaks the animation. Always compute elapsed time as `performance.now() - startTime`, using `performance.now()` on both sides consistently; never use the rAF callback's own timestamp argument for this calculation.

---

### Task 1: Real segment geometry via Overpass extraction

**Why first:** every other task in this plan (mile markers, animation, desktop map) depends on real, road-following coordinates existing. The current `src/components/ParkMap.js` hardcodes ~5-point-per-segment approximate coordinates that don't match the actual roads — e.g. its `drive_south` coordinates sum to **0.85 mi** of haversine distance against a declared `1.44 mi` in `segments.json` (verified by calculation), which is why `showRoutes` was hardcoded to `false` in that file.

**Nature of this task:** unlike the other tasks, this is a data-extraction script whose correctness gate is an automated self-check report the script itself prints, not a fixed set of unit tests written up front. Real-world OSM data requires inspection and iteration — this is normal for geographic data wrangling, not a sign of a wrong approach. Budget for a few iterations.

**Verified facts to build on (already confirmed working, so you don't have to rediscover them):**
- The public Overpass endpoint `https://overpass-api.de/api/interpreter` returns **406 Not Acceptable** unless the request includes `Accept: application/json` and a non-default `User-Agent` header alongside `Content-Type: text/plain` — with those three headers, a POST with the query as the raw body succeeds.
- Querying `way["highway"]` inside Central Park's bounding box `(40.7649,-73.9810,40.7968,-73.9490)` with `out geom;` returns **6948 ways**, every one carrying inline `geometry: [{lat,lon},...]` — no separate node-resolution pass is needed.
- Real OSM names found in that data relevant to our 8 segments: `"East Drive"` (53 way fragments), `"West Drive"` (47), `"Center Drive"` (8), `"72nd Street Transverse"` (7 — matches `transverse_72` by name), `"102nd Street Crossing"` (3 — **not** "102nd Street Transverse"; this is the real name for `transverse_102`), `"Northwest Central Park Loop"` (41), `"Central Park Outer Loop"` (54), `"Stephanie and Fred Shuman Reservoir Running Track"` (1 — the reservoir). **The bridle path has no `name` tag at all** — it's one of 5707 unnamed ways in the bbox. This confirms name-based matching alone cannot work for all 8 segments; classification must be geometry-based (matching against reference coordinates), not name-based. Names are a debugging aid, not the primary matching mechanism in the algorithm below.
- "Central Park Outer Loop" and "East Drive"/"West Drive" having similar way-counts (54 vs 53/47) suggests the same physical corridor may be dual-tagged (e.g. a marked running/cycling designation layered over the vehicular drive tag). The fetch query below intentionally does not filter by `highway` sub-type for this reason — the geometry-based classification in the algorithm handles this by picking whichever candidate best matches the reference shape, regardless of tagging.

**Files:**
- Create: `scripts/extractGeometry.js`
- Create (generated output, committed to git): `src/data/segmentGeometry.json`

**Interfaces:**
- Consumes: `src/data/segments.json` (existing; for each segment's declared `distance_mi`, and for `bridle_path`/`reservoir`'s `standalone` flag — not otherwise used, no schema change).
- Produces: `src/data/segmentGeometry.json` with exact shape `{ "<segmentId>": [[lat, lon], [lat, lon], ...], ... }` — one entry per one of the 8 segment IDs (`drive_south`, `drive_east_mid`, `drive_north`, `drive_west_mid`, `transverse_72`, `transverse_102`, `reservoir`, `bridle_path`), each a dense array of `[lat, lon]` pairs tracing that segment's real path. Task 2's `routePath.js` and Task 3's `ParkMap.js` both import this file directly and index into it by segment ID.

- [ ] **Step 1: Write the extraction script**

Create `scripts/extractGeometry.js`:

```js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const segmentsData = require('../src/data/segments.json');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = [40.7649, -73.9810, 40.7968, -73.9490]; // south, west, north, east
const OUTPUT_PATH = path.join(__dirname, '../src/data/segmentGeometry.json');
const EARTH_RADIUS_MI = 3958.8;
const MATCH_SCORE_THRESHOLD_MI = 0.05; // avg nearest-point distance; above this, treat as "no good match"
const TOLERANCE_MI = 0.1;

// Seed reference geometry: the pre-existing approximate hand-placed
// coordinates from the original ParkMap.js. These are NOT accurate enough
// to ship (see haversine check above) but their relative layout is roughly
// correct, so they're used only to find and trim the matching real OSM
// way(s) below -- they are never written to the output file.
const REFERENCE_COORDS = {
  drive_south: [
    [40.7680, -73.9765], [40.7700, -73.9745], [40.7730, -73.9715],
    [40.7755, -73.9690], [40.7780, -73.9670],
  ],
  drive_east_mid: [
    [40.7780, -73.9670], [40.7810, -73.9610], [40.7850, -73.9570],
    [40.7890, -73.9540], [40.7920, -73.9515],
  ],
  drive_north: [
    [40.7920, -73.9515], [40.7945, -73.9510], [40.7965, -73.9525],
    [40.7955, -73.9560], [40.7930, -73.9590],
  ],
  drive_west_mid: [
    [40.7930, -73.9590], [40.7890, -73.9650], [40.7850, -73.9700],
    [40.7810, -73.9750], [40.7780, -73.9790],
  ],
  transverse_72: [[40.7780, -73.9790], [40.7780, -73.9670]],
  transverse_102: [[40.7930, -73.9590], [40.7930, -73.9515]],
  reservoir: [
    [40.7795, -73.9620], [40.7815, -73.9595], [40.7845, -73.9580],
    [40.7875, -73.9585], [40.7895, -73.9605], [40.7905, -73.9640],
    [40.7895, -73.9675], [40.7865, -73.9695], [40.7825, -73.9690],
    [40.7795, -73.9620],
  ],
  bridle_path: [
    [40.7770, -73.9635], [40.7800, -73.9595], [40.7840, -73.9570],
    [40.7885, -73.9575], [40.7915, -73.9600], [40.7925, -73.9645],
    [40.7910, -73.9690], [40.7875, -73.9710], [40.7825, -73.9705],
    [40.7770, -73.9635],
  ],
};

function haversineMiles([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pathLengthMiles(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMiles(coords[i - 1], coords[i]);
  return total;
}

function pointsEqual(a, b, epsilon = 1e-7) {
  return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
}

async function fetchWays() {
  const query = `[out:json][timeout:60];(way["highway"](${BBOX.join(',')}););out geom;`;
  const response = await axios.post(OVERPASS_URL, query, {
    headers: {
      'Content-Type': 'text/plain',
      Accept: 'application/json',
      'User-Agent': 'centralpark-run-geometry-script/1.0',
    },
    timeout: 60000,
  });
  return response.data.elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => ({
      id: el.id,
      name: el.tags?.name || null,
      highway: el.tags?.highway,
      coords: el.geometry.map((pt) => [pt.lat, pt.lon]),
    }));
}

// Merges ways that share an endpoint into maximal connected chains.
function chainWays(ways) {
  const remaining = ways.map((w) => w.coords.slice());
  const chains = [];
  while (remaining.length) {
    let chain = remaining.shift();
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        const wStart = w[0];
        const wEnd = w[w.length - 1];
        const chainStart = chain[0];
        const chainEnd = chain[chain.length - 1];
        if (pointsEqual(chainEnd, wStart)) {
          chain = chain.concat(w.slice(1));
        } else if (pointsEqual(chainEnd, wEnd)) {
          chain = chain.concat(w.slice(0, -1).reverse());
        } else if (pointsEqual(chainStart, wEnd)) {
          chain = w.slice(0, -1).concat(chain);
        } else if (pointsEqual(chainStart, wStart)) {
          chain = w.slice(1).reverse().concat(chain);
        } else {
          continue;
        }
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

function nearestPointIndex(point, chain) {
  let bestIdx = 0;
  let bestDist = Infinity;
  chain.forEach((p, idx) => {
    const d = haversineMiles(point, p);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  return { idx: bestIdx, dist: bestDist };
}

function averageMatchDistance(reference, chain) {
  let total = 0;
  for (const point of reference) total += nearestPointIndex(point, chain).dist;
  return total / reference.length;
}

// Trims a (possibly much longer) matched chain down to the sub-range that
// corresponds to the reference segment's start/end.
function trimChainToReference(chain, reference) {
  const startMatch = nearestPointIndex(reference[0], chain);
  const endMatch = nearestPointIndex(reference[reference.length - 1], chain);
  if (startMatch.idx <= endMatch.idx) {
    return chain.slice(startMatch.idx, endMatch.idx + 1);
  }
  return chain.slice(endMatch.idx, startMatch.idx + 1).reverse();
}

async function main() {
  console.log('Fetching park ways from Overpass...');
  const ways = await fetchWays();
  console.log(`Fetched ${ways.length} ways with geometry`);

  console.log('Chaining connected ways...');
  const chains = chainWays(ways);
  console.log(`Formed ${chains.length} connected chains`);

  const output = {};
  const report = [];

  for (const [segmentId, reference] of Object.entries(REFERENCE_COORDS)) {
    let best = null;
    let bestScore = Infinity;
    for (const chain of chains) {
      if (chain.length < 2) continue;
      const score = averageMatchDistance(reference, chain);
      if (score < bestScore) {
        bestScore = score;
        best = chain;
      }
    }

    if (!best || bestScore > MATCH_SCORE_THRESHOLD_MI) {
      report.push({ segmentId, status: 'NO GOOD MATCH', matchScoreMi: bestScore.toFixed(4) });
      continue;
    }

    const trimmed = trimChainToReference(best, reference);
    const actualMi = pathLengthMiles(trimmed);
    const expectedMi = segmentsData.segments.find((s) => s.id === segmentId).distance_mi;
    const withinTolerance = Math.abs(actualMi - expectedMi) <= TOLERANCE_MI;

    output[segmentId] = trimmed;
    report.push({
      segmentId,
      status: withinTolerance ? 'OK' : 'OUT OF TOLERANCE',
      matchScoreMi: bestScore.toFixed(4),
      actualMi: actualMi.toFixed(2),
      expectedMi,
    });
  }

  console.log('\nSelf-check report:');
  console.table(report);

  const anyFailed = report.some((r) => r.status !== 'OK');
  if (anyFailed) {
    console.error('\nOne or more segments failed self-check. See Step 3 (Debugging) below before proceeding.');
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `node scripts/extractGeometry.js`

Expected: a table printing one row per segment ID with `status: 'OK'`, `matchScoreMi` well under `0.05`, and `actualMi` within `0.1` of `expectedMi`. On success, `src/data/segmentGeometry.json` is written.

- [ ] **Step 3: Debugging (only if Step 2 reports failures)**

This step is not optional filler — real OSM data will very likely need at least one round of this. Work through whichever applies:

- **`NO GOOD MATCH`** (bestScore too high or no chain found): the reference shape doesn't closely resemble any single connected real-world chain. Likely cause: the physical road is broken into multiple *disconnected* chains in OSM (e.g. interrupted at a bridge or a `tunnel=yes` way that doesn't share exact endpoint coordinates with its neighbors). Fix: loosen `pointsEqual`'s `epsilon` first (try `1e-5`); if that doesn't help, add a second chaining pass that merges chain endpoints within ~15 meters (`haversineMiles(a, b) < 0.01`) instead of requiring exact equality.
- **`OUT OF TOLERANCE`** despite a low match score: the trim boundary likely snapped to the wrong point at a junction where multiple candidate paths cross near the reference's start/end (e.g. where a spur path meets the main drive). Dump the winning chain to a scratch file (`fs.writeFileSync('/tmp/debug-<segmentId>.json', JSON.stringify(trimmed))`) and inspect it — paste its coordinates into [geojson.io](https://geojson.io) as a LineString to see it plotted against a real map and confirm where it goes wrong.
- **Two segments end up with implausibly similar or overlapping geometry**: likely the "Outer Loop"/"East Drive"-style dual-tagging noted above matched a marked path parallel to the actual drive. Inspect the `ways` array for that segment's matched `id`s (log `best.name`/`highway` before trimming) and consider excluding a specific `highway` tag value from the fetch query's `way["highway"]` filter if one tag value is consistently the wrong/duplicate one.
- **Fallback of last resort**: if a specific segment can't be resolved this way after a reasonable effort, manually trace it in geojson.io over satellite imagery, export as GeoJSON, and convert its `coordinates` (note: GeoJSON is `[lon, lat]` — reverse to `[lat, lon]`) directly into that one entry of `src/data/segmentGeometry.json`, then re-run Step 2 to confirm it now passes tolerance. This keeps the other 7 segments on the automated path.

Re-run Step 2 after each fix until all 8 segments show `OK`.

- [ ] **Step 4: Commit**

```bash
git add scripts/extractGeometry.js src/data/segmentGeometry.json
git commit -m "feat: extract real Central Park path geometry from OpenStreetMap"
```

---

### Task 2: Pure geo-math utilities

**Files:**
- Create: `src/utils/geoMath.js`
- Test: `src/utils/geoMath.test.js`
- Create: `src/utils/routePath.js`
- Test: `src/utils/routePath.test.js`

**Interfaces:**
- Consumes: nothing external for `geoMath.js` (pure functions over plain coordinate arrays). `routePath.js` consumes `getLoop` from the existing `src/utils/routeEngine.js` (already exported: `getLoop(id) → loop | undefined`, where `loop.segments` is an ordered array of segment IDs — verified in current `routeEngine.js`).
- Produces (consumed by Task 3 and Task 4): from `geoMath.js` — `haversineMiles([lat,lon],[lat,lon]) → number`, `pathLengthMiles(coords) → number`, `cumulativeDistances(coords) → number[]`, `interpolateAlongPath(coords, fraction) → [lat,lon] | null`, `slicePathToFraction(coords, fraction) → [lat,lon][]`, `getMileMarkers(coords, spacingMi=1) → {position:[lat,lon], mile:number}[]`, `bearingDegrees([lat,lon],[lat,lon]) → number` (0-360), `getDirectionArrows(coords, spacingMi=0.5) → {position:[lat,lon], bearing:number}[]`. From `routePath.js` — `buildRoutePath(route, segmentGeometryMap) → [lat,lon][]`, where `route` is a `suggestRoutes()` result object (has `.loops: [{id, name, repeat}]`) and `segmentGeometryMap` is the object shape produced by Task 1 (`{ segmentId: [[lat,lon],...] }`).

- [ ] **Step 1: Write the failing tests for geoMath.js**

Create `src/utils/geoMath.test.js`:

```js
import {
  haversineMiles,
  pathLengthMiles,
  cumulativeDistances,
  interpolateAlongPath,
  slicePathToFraction,
  getMileMarkers,
  bearingDegrees,
  getDirectionArrows,
} from './geoMath';

const STRAIGHT_PATH = [
  [40.75, -73.96],
  [41.75, -73.96],
  [42.75, -73.96],
];

test('haversineMiles of a point to itself is 0', () => {
  expect(haversineMiles([40.75, -73.96], [40.75, -73.96])).toBe(0);
});

test('haversineMiles for 1 degree of latitude is approximately 69.1 miles', () => {
  expect(haversineMiles([40.75, -73.96], [41.75, -73.96])).toBeCloseTo(69.09, 1);
});

test('haversineMiles is symmetric', () => {
  const a = [40.75, -73.96];
  const b = [40.80, -73.90];
  expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 10);
});

test('pathLengthMiles sums consecutive segment distances', () => {
  expect(pathLengthMiles(STRAIGHT_PATH)).toBeCloseTo(69.09 * 2, 0);
});

test('cumulativeDistances starts at 0 and is monotonically increasing', () => {
  const cum = cumulativeDistances(STRAIGHT_PATH);
  expect(cum).toHaveLength(3);
  expect(cum[0]).toBe(0);
  expect(cum[1]).toBeGreaterThan(cum[0]);
  expect(cum[2]).toBeGreaterThan(cum[1]);
});

test('interpolateAlongPath at fraction 0 returns the first point', () => {
  expect(interpolateAlongPath(STRAIGHT_PATH, 0)).toEqual(STRAIGHT_PATH[0]);
});

test('interpolateAlongPath at fraction 1 returns the last point', () => {
  expect(interpolateAlongPath(STRAIGHT_PATH, 1)).toEqual(STRAIGHT_PATH[2]);
});

test('interpolateAlongPath at fraction 0.5 returns the midpoint', () => {
  const mid = interpolateAlongPath(STRAIGHT_PATH, 0.5);
  expect(mid[0]).toBeCloseTo(41.75, 1);
});

test('slicePathToFraction at 0 returns only the first point', () => {
  expect(slicePathToFraction(STRAIGHT_PATH, 0)).toEqual([STRAIGHT_PATH[0]]);
});

test('slicePathToFraction at 1 returns the full path', () => {
  expect(slicePathToFraction(STRAIGHT_PATH, 1)).toEqual(STRAIGHT_PATH);
});

test('getMileMarkers places a marker roughly every mile and none past the end', () => {
  const markers = getMileMarkers(STRAIGHT_PATH, 1);
  expect(markers.length).toBeGreaterThan(100); // ~138 miles of path at 1mi spacing
  expect(markers[0].mile).toBeCloseTo(1, 1);
  const total = pathLengthMiles(STRAIGHT_PATH);
  expect(markers[markers.length - 1].mile).toBeLessThan(total);
});

test('bearingDegrees due north is 0', () => {
  expect(bearingDegrees([40.75, -73.96], [41.75, -73.96])).toBeCloseTo(0, 0);
});

test('bearingDegrees due east is 90', () => {
  expect(bearingDegrees([40.75, -73.96], [40.75, -73.86])).toBeCloseTo(90, 0);
});

test('getDirectionArrows returns arrows with a position and bearing', () => {
  const arrows = getDirectionArrows(STRAIGHT_PATH, 50);
  expect(arrows.length).toBeGreaterThan(0);
  expect(arrows[0]).toHaveProperty('position');
  expect(arrows[0]).toHaveProperty('bearing');
  expect(arrows[0].bearing).toBeCloseTo(0, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/utils/geoMath.test.js`
Expected: FAIL — `Cannot find module './geoMath'`.

- [ ] **Step 3: Implement geoMath.js**

Create `src/utils/geoMath.js`:

```js
const EARTH_RADIUS_MI = 3958.8;

export function haversineMiles([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

export function pathLengthMiles(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMiles(coords[i - 1], coords[i]);
  }
  return total;
}

export function cumulativeDistances(coords) {
  const result = [0];
  for (let i = 1; i < coords.length; i++) {
    result.push(result[i - 1] + haversineMiles(coords[i - 1], coords[i]));
  }
  return result;
}

export function interpolateAlongPath(coords, fraction) {
  if (coords.length === 0) return null;
  if (fraction <= 0) return coords[0];
  if (fraction >= 1) return coords[coords.length - 1];

  const cumDist = cumulativeDistances(coords);
  const total = cumDist[cumDist.length - 1];
  const targetDist = total * fraction;

  for (let i = 1; i < cumDist.length; i++) {
    if (cumDist[i] >= targetDist) {
      const segStart = cumDist[i - 1];
      const segEnd = cumDist[i];
      const segFraction = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);
      const [lat1, lon1] = coords[i - 1];
      const [lat2, lon2] = coords[i];
      return [lat1 + (lat2 - lat1) * segFraction, lon1 + (lon2 - lon1) * segFraction];
    }
  }
  return coords[coords.length - 1];
}

export function slicePathToFraction(coords, fraction) {
  if (fraction <= 0) return coords.length ? [coords[0]] : [];
  if (fraction >= 1) return coords;

  const cumDist = cumulativeDistances(coords);
  const total = cumDist[cumDist.length - 1];
  const targetDist = total * fraction;

  const sliced = [];
  for (let i = 0; i < coords.length; i++) {
    sliced.push(coords[i]);
    if (cumDist[i] >= targetDist) break;
  }
  const last = sliced[sliced.length - 1];
  const interpolated = interpolateAlongPath(coords, fraction);
  if (interpolated && (interpolated[0] !== last[0] || interpolated[1] !== last[1])) {
    sliced.push(interpolated);
  }
  return sliced;
}

export function getMileMarkers(coords, spacingMi = 1) {
  const total = pathLengthMiles(coords);
  const markers = [];
  for (let mile = spacingMi; mile < total; mile += spacingMi) {
    const fraction = mile / total;
    const point = interpolateAlongPath(coords, fraction);
    markers.push({ position: point, mile: Math.round(mile * 10) / 10 });
  }
  return markers;
}

export function bearingDegrees([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export function getDirectionArrows(coords, spacingMi = 0.5) {
  const total = pathLengthMiles(coords);
  const arrows = [];
  for (let dist = spacingMi / 2; dist < total; dist += spacingMi) {
    const fraction = dist / total;
    const point = interpolateAlongPath(coords, fraction);
    const aheadFraction = Math.min(1, (dist + 0.05) / total);
    const aheadPoint = interpolateAlongPath(coords, aheadFraction);
    arrows.push({ position: point, bearing: bearingDegrees(point, aheadPoint) });
  }
  return arrows;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/utils/geoMath.test.js`
Expected: all tests pass.

- [ ] **Step 5: Write the failing tests for routePath.js**

Create `src/utils/routePath.test.js`:

```js
import { buildRoutePath } from './routePath';

const FAKE_GEOMETRY = {
  drive_south: [[1, 1], [2, 2]],
  transverse_72: [[2, 2], [3, 3]],
};

test('returns empty array for a null route', () => {
  expect(buildRoutePath(null, FAKE_GEOMETRY)).toEqual([]);
});

test('concatenates a single loop\'s segments in order', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  // southern_loop = ['drive_south', 'transverse_72'] per segments.json
  expect(result).toEqual([[1, 1], [2, 2], [2, 2], [3, 3]]);
});

test('repeats a loop\'s coordinates the given number of times', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 2 }] };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  expect(result).toHaveLength(8);
  expect(result.slice(0, 4)).toEqual(result.slice(4, 8));
});

test('concatenates across multiple loop entries in listed order', () => {
  const route = {
    loops: [
      { id: 'southern_loop', name: 'Southern Loop', repeat: 1 },
      { id: 'southern_loop', name: 'Southern Loop', repeat: 1 },
    ],
  };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  expect(result).toHaveLength(8);
});

test('skips a segment missing from the geometry map without throwing', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, { drive_south: [[1, 1], [2, 2]] });
  expect(result).toEqual([[1, 1], [2, 2]]);
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/utils/routePath.test.js`
Expected: FAIL — `Cannot find module './routePath'`.

- [ ] **Step 7: Implement routePath.js**

Create `src/utils/routePath.js`:

```js
import { getLoop } from './routeEngine';

export function buildRoutePath(route, segmentGeometryMap) {
  if (!route || !route.loops) return [];

  const path = [];
  for (const loopEntry of route.loops) {
    const loop = getLoop(loopEntry.id);
    if (!loop) continue;
    for (let rep = 0; rep < loopEntry.repeat; rep++) {
      for (const segId of loop.segments) {
        const coords = segmentGeometryMap[segId];
        if (!coords) continue;
        path.push(...coords);
      }
    }
  }
  return path;
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npm test -- src/utils/routePath.test.js src/utils/geoMath.test.js`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/utils/geoMath.js src/utils/geoMath.test.js src/utils/routePath.js src/utils/routePath.test.js
git commit -m "feat: add pure geo-math and route-path utilities"
```

---

### Task 3: ParkMap real-geometry rendering

**Files:**
- Modify: `src/components/ParkMap.js` (full rewrite)
- Test: `src/components/ParkMap.test.js`
- Modify: `src/components/RoutePlanner.js`

**Interfaces:**
- Consumes: `src/data/segmentGeometry.json` (Task 1), `getMileMarkers`/`getDirectionArrows` (Task 2), `buildRoutePath` (Task 2).
- Produces: `ParkMap`'s new prop shape — `{ animatedPath = [], affectedSegments = [] }` (the old `highlightedSegments`, `onSegmentClick`, and `compact` props are removed; `onSegmentClick` was dead code — grep confirms no caller ever passed it, and `compact` was likewise never passed by the only caller, `RoutePlanner.js`). Task 4 adds animation on top of `animatedPath` without changing this prop's name or shape — Task 4 just changes what `RoutePlanner` passes into it.

- [ ] **Step 1: Write the failing tests**

These tests mock `react-leaflet` entirely and assert on the props passed to its (mocked) components — real vector layers cannot be rendered in this jsdom environment (see Global Constraints). This is the verified, correct way to test this component.

Create `src/components/ParkMap.test.js`:

```js
import React from 'react';
import { render } from '@testing-library/react';

const mockPolyline = jest.fn(() => null);
const mockCircleMarker = jest.fn(() => null);

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: (props) => <div data-testid="tile-layer" data-url={props.url} />,
  Polyline: (props) => {
    mockPolyline(props);
    return null;
  },
  CircleMarker: (props) => {
    mockCircleMarker(props);
    return props.children ? <div>{props.children}</div> : null;
  },
  Tooltip: ({ children }) => <div data-testid="tooltip">{children}</div>,
  Marker: (props) => <div data-testid="marker" data-position={JSON.stringify(props.position)} />,
  useMap: () => ({ fitBounds: jest.fn() }),
}));

jest.mock('../data/segmentGeometry.json', () => ({
  drive_south: [[40.768, -73.9765], [40.778, -73.967]],
  reservoir: [[40.7795, -73.962], [40.7845, -73.958], [40.7795, -73.962]],
}));

import ParkMap from './ParkMap';

beforeEach(() => {
  mockPolyline.mockClear();
  mockCircleMarker.mockClear();
});

test('renders the Carto Positron tile layer', () => {
  const { getByTestId } = render(<ParkMap />);
  expect(getByTestId('tile-layer').dataset.url).toBe(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  );
});

test('renders an affected segment as a dashed warning polyline', () => {
  render(<ParkMap affectedSegments={['drive_south']} />);
  const affectedCall = mockPolyline.mock.calls.find(
    ([props]) => props.positions === undefined ? false : props.positions[0][0] === 40.768
  );
  expect(affectedCall).toBeTruthy();
  expect(affectedCall[0].pathOptions.dashArray).toBe('10, 5');
});

test('renders the animated path as a solid polyline', () => {
  const path = [[40.77, -73.97], [40.78, -73.96]];
  render(<ParkMap animatedPath={path} />);
  const solidCall = mockPolyline.mock.calls.find(
    ([props]) => JSON.stringify(props.positions) === JSON.stringify(path)
  );
  expect(solidCall).toBeTruthy();
  expect(solidCall[0].pathOptions.dashArray).toBeUndefined();
});

test('renders a start marker at the first point of the animated path', () => {
  const path = [[40.77, -73.97], [40.78, -73.96]];
  const { getByTestId } = render(<ParkMap animatedPath={path} />);
  expect(JSON.parse(getByTestId('marker').dataset.position)).toEqual([40.77, -73.97]);
});

test('renders no polylines or markers when given no animated path or affected segments', () => {
  render(<ParkMap />);
  expect(mockPolyline).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/ParkMap.test.js`
Expected: FAIL, since `ParkMap.js` doesn't yet accept `animatedPath`/read `segmentGeometry.json`/emit these props.

- [ ] **Step 3: Rewrite ParkMap.js**

Replace the entire contents of `src/components/ParkMap.js` with:

```js
import React, { useMemo } from 'react';
import { Box, Paper, useTheme } from '@mui/material';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import segmentGeometry from '../data/segmentGeometry.json';
import { getMileMarkers, getDirectionArrows } from '../utils/geoMath';

const CENTRAL_PARK_BOUNDS = [
  [40.7649, -73.9810],
  [40.7968, -73.9490],
];

const FitBounds = ({ bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }, [map, bounds]);
  return null;
};

const arrowIcon = (bearing) =>
  L.divIcon({
    html: `<div style="transform: rotate(${bearing}deg); font-size: 16px; line-height: 16px; color: #2e7d32;">&#9650;</div>`,
    className: 'route-direction-arrow',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const startIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#2e7d32;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>',
  className: 'route-start-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const ParkMap = ({ animatedPath = [], affectedSegments = [] }) => {
  const theme = useTheme();

  const affectedCoords = useMemo(
    () => affectedSegments.map((id) => segmentGeometry[id]).filter(Boolean),
    [affectedSegments]
  );

  const mileMarkers = useMemo(
    () => (animatedPath.length > 1 ? getMileMarkers(animatedPath) : []),
    [animatedPath]
  );

  const arrows = useMemo(
    () => (animatedPath.length > 1 ? getDirectionArrows(animatedPath) : []),
    [animatedPath]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ width: '100%', height: 450, borderRadius: 2, overflow: 'hidden' }}>
        <MapContainer
          center={[40.7812, -73.9665]}
          zoom={14}
          zoomControl={true}
          dragging={true}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBounds bounds={CENTRAL_PARK_BOUNDS} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {affectedCoords.map((coords, i) => (
            <Polyline
              key={`affected-${i}`}
              positions={coords}
              pathOptions={{
                color: theme.palette.warning.main,
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5',
              }}
            />
          ))}

          {animatedPath.length > 1 && (
            <Polyline
              positions={animatedPath}
              pathOptions={{ color: theme.palette.primary.main, weight: 6, opacity: 1 }}
            />
          )}

          {animatedPath.length > 0 && <Marker position={animatedPath[0]} icon={startIcon} />}

          {arrows.map((arrow, i) => (
            <Marker key={`arrow-${i}`} position={arrow.position} icon={arrowIcon(arrow.bearing)} />
          ))}

          {mileMarkers.map((marker) => (
            <CircleMarker
              key={`mile-${marker.mile}`}
              center={marker.position}
              radius={5}
              pathOptions={{ color: theme.palette.text.primary, fillColor: '#fff', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip permanent direction="top" offset={[0, -6]}>
                {marker.mile} mi
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
    </Paper>
  );
};

export default ParkMap;
```

- [ ] **Step 4: Update RoutePlanner.js to use the new prop shape**

In `src/components/RoutePlanner.js`, add these imports alongside the existing ones:

```js
import segmentGeometry from '../data/segmentGeometry.json';
import { buildRoutePath } from '../utils/routePath';
```

Add this computed value next to the existing `activeRoute` line (after `const activeRoute = routes[selectedRouteIdx] || null;`):

```js
const routePath = useMemo(
  () => (activeRoute ? buildRoutePath(activeRoute, segmentGeometry) : []),
  [activeRoute]
);
```

Replace the existing `<ParkMap highlightedSegments={activeRoute?.segmentIds || []} affectedSegments={affectedSegmentIds} />` call with:

```jsx
<ParkMap animatedPath={routePath} affectedSegments={affectedSegmentIds} />
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- src/components/ParkMap.test.js`
Expected: all tests pass.

Run: `npm test`
Expected: all suites still pass (this confirms `RoutePlanner`'s changes didn't break the existing app-level smoke test — at this point in the plan, `RoutePlanner`/`ParkMap` are still only reachable via the mobile tab, which the default jsdom `isMobile=false` environment doesn't render, so `App.test.js` does not yet exercise real `ParkMap` rendering).

- [ ] **Step 6: Commit**

```bash
git add src/components/ParkMap.js src/components/ParkMap.test.js src/components/RoutePlanner.js
git commit -m "feat: render real Central Park geometry with Carto Positron tiles and mile markers"
```

---

### Task 4: Route-draw animation

**Files:**
- Create: `src/hooks/useRouteAnimation.js`
- Test: `src/hooks/useRouteAnimation.test.js`
- Modify: `src/components/RoutePlanner.js`

**Interfaces:**
- Consumes: `slicePathToFraction` from `src/utils/geoMath.js` (Task 2).
- Produces: `useRouteAnimation(path, durationMs = 1500) → { animatedPath: [lat,lon][], progress: number }`. `RoutePlanner.js` is the only consumer.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useRouteAnimation.test.js`:

```js
import { act, renderHook } from '@testing-library/react';
import useRouteAnimation from './useRouteAnimation';

const PATH = [
  [40.77, -73.97],
  [40.78, -73.96],
  [40.79, -73.95],
];

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('starts at progress 0 with only the first point', () => {
  const { result } = renderHook(() => useRouteAnimation(PATH, 1000));
  expect(result.current.progress).toBe(0);
  expect(result.current.animatedPath).toEqual([PATH[0]]);
});

test('reaches progress 1 and the full path once duration elapses', () => {
  const { result } = renderHook(() => useRouteAnimation(PATH, 1000));
  act(() => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.progress).toBe(1);
  expect(result.current.animatedPath).toEqual(PATH);
});

test('empty path yields empty animatedPath and progress 0', () => {
  const { result } = renderHook(() => useRouteAnimation([], 1000));
  expect(result.current.progress).toBe(0);
  expect(result.current.animatedPath).toEqual([]);
});

test('restarts animation from 0 when the path reference changes', () => {
  const { result, rerender } = renderHook(({ path }) => useRouteAnimation(path, 1000), {
    initialProps: { path: PATH },
  });
  act(() => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.progress).toBe(1);

  const NEW_PATH = [
    [40.8, -73.94],
    [40.81, -73.93],
  ];
  rerender({ path: NEW_PATH });
  expect(result.current.progress).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/hooks/useRouteAnimation.test.js`
Expected: FAIL — `Cannot find module './useRouteAnimation'`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useRouteAnimation.js`:

```js
import { useState, useEffect, useRef } from 'react';
import { slicePathToFraction } from '../utils/geoMath';

export default function useRouteAnimation(path, durationMs = 1500) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!path || path.length === 0) {
      setProgress(0);
      return undefined;
    }

    setProgress(0);
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const nextProgress = Math.min(1, elapsed / durationMs);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [path, durationMs]);

  const animatedPath = path && path.length > 0 ? slicePathToFraction(path, progress) : [];

  return { animatedPath, progress };
}
```

Note: `elapsed` deliberately uses `performance.now()` on both sides rather than the timestamp argument `requestAnimationFrame` passes to its callback — see Global Constraints for why mixing the two breaks under fake timers.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/hooks/useRouteAnimation.test.js`
Expected: all 4 tests pass.

- [ ] **Step 5: Wire the hook into RoutePlanner**

In `src/components/RoutePlanner.js`, add the import:

```js
import useRouteAnimation from '../hooks/useRouteAnimation';
```

Change the `routePath` block added in Task 3 by adding this line directly after it:

```js
const { animatedPath } = useRouteAnimation(routePath);
```

Change the `<ParkMap animatedPath={routePath} affectedSegments={affectedSegmentIds} />` call (added in Task 3) to:

```jsx
<ParkMap animatedPath={animatedPath} affectedSegments={affectedSegmentIds} />
```

- [ ] **Step 6: Run to verify nothing broke**

Run: `npm test`
Expected: all suites pass (existing `ParkMap.test.js` tests are unaffected — they pass `animatedPath` directly as a prop and don't go through `RoutePlanner`/the hook).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRouteAnimation.js src/hooks/useRouteAnimation.test.js src/components/RoutePlanner.js
git commit -m "feat: animate route selection drawing in over 1.5s"
```

---

### Task 5: Bring the Route Planner to desktop

**Why:** the Route Planner (map + distance picker + route cards) currently only renders inside a mobile-only tab (`isMobile && tabValue === 1` in `EventList.js`) — on desktop it's completely hidden. This was a workaround from when the map had no real geometry; Tasks 1-4 fixed that, so this restriction is no longer warranted.

**Files:**
- Modify: `src/components/EventList.js`
- Modify: `src/App.test.js`
- Create: `src/components/EventList.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (this is a layout-only change; no new exports).

- [ ] **Step 1: Write the failing tests**

Create `src/components/EventList.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventList from './EventList';

jest.mock('./ParkMap', () => () => <div data-testid="mock-park-map" />);

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('EVENT_NAME,DATE,START_TIME,END_TIME,LOCATION,DESCRIPTION,URL\n'),
      json: () => Promise.resolve({}),
    })
  );
});

afterEach(() => {
  delete window.matchMedia;
});

function mockIsMobile(matches) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

test('desktop shows Plan Your Route without needing a tab click', async () => {
  mockIsMobile(false);
  render(
    <MemoryRouter>
      <EventList />
    </MemoryRouter>
  );
  expect(await screen.findByText(/plan your route/i)).toBeInTheDocument();
});

test('mobile hides Plan Your Route until the Plan tab is selected', async () => {
  mockIsMobile(true);
  render(
    <MemoryRouter>
      <EventList />
    </MemoryRouter>
  );
  await screen.findByText(/should i run in central park today/i);
  expect(screen.queryByText(/plan your route/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/EventList.test.js`
Expected: the desktop test FAILS (`Unable to find an element with the text: /plan your route/i`) because `RoutePlanner` is still gated behind the mobile tab; the mobile test PASSES already (this is expected — it's pinning today's correct mobile behavior, which this task must not break).

- [ ] **Step 3: Restructure EventList.js for a desktop two-column layout**

In `src/components/EventList.js`, change the `Container` `maxWidth` from `"md"` to `"lg"` (more room is needed for two columns on desktop; on mobile the content still stacks to full width via `xs={12}` so this has no mobile effect):

```jsx
<Container maxWidth="lg" sx={{ py: 2 }}>
```

Replace the two conditional blocks inside the `<Grid container spacing={2}>` — the `{(!isMobile || tabValue === 0) && (<React.Fragment>...` block (containing Weather Alerts through Upcoming Events) and the `{isMobile && tabValue === 1 && (<>...` block (containing `RoutePlanner`/`WeekStrip`) — with the same inner content, wrapped in two responsive `Grid item`s instead. Concretely:

- Wrap the **opening** of the first block: change `{(!isMobile || tabValue === 0) && (<React.Fragment>` to:
```jsx
{(!isMobile || tabValue === 0) && (
  <Grid item xs={12} md={7}>
    <Grid container spacing={2}>
```
- Change that block's **closing** `</React.Fragment>\n)}` to:
```jsx
    </Grid>
  </Grid>
)}
```
- Replace the entire second block:
```jsx
{isMobile && tabValue === 1 && (
  <>
  <Grid item xs={12}>
    <RoutePlanner todayEvents={todayEvents} />
  </Grid>
  <Grid item xs={12}>
    <WeekStrip events={upcomingEvents} hourlyForecast={hourlyForecast} />
  </Grid>
</>
)}
```
with:
```jsx
{(!isMobile || tabValue === 1) && (
  <Grid item xs={12} md={5}>
    <Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
      <Stack spacing={2}>
        <RoutePlanner todayEvents={todayEvents} />
        <WeekStrip events={upcomingEvents} hourlyForecast={hourlyForecast} />
      </Stack>
    </Box>
  </Grid>
)}
```

The Footer `Grid item xs={12}` block that follows stays exactly as-is, outside both conditionals, so it always spans full width below both columns on every breakpoint.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/EventList.test.js`
Expected: both tests pass.

- [ ] **Step 5: Fix the regression this introduces in App.test.js**

With `RoutePlanner`/`ParkMap` now reachable on the default (desktop) render path, `src/App.test.js`'s existing smoke test will mount the real, unmocked `ParkMap` — which throws under jsdom (see Global Constraints). Fix by mocking `ParkMap` there too, the same way `EventList.test.js` does it.

In `src/App.test.js`, add this line after the existing imports (before `beforeEach`):

```js
jest.mock('./components/ParkMap', () => () => <div data-testid="mock-park-map" />);
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all suites pass, including `App.test.js` and the new `EventList.test.js`.

- [ ] **Step 7: Commit**

```bash
git add src/components/EventList.js src/components/EventList.test.js src/App.test.js
git commit -m "feat: show Route Planner on desktop instead of mobile-only tab"
```

---

### Task 6 (optional/stretch): GPX export

**Note:** the design spec explicitly marks this as optional ("Optional, but the geometry makes it nearly free"). It is fully specified below in case it's picked up, but Tasks 1-5 are the complete, shippable core of this plan on their own.

**Files:**
- Create: `src/utils/gpxExport.js`
- Test: `src/utils/gpxExport.test.js`
- Modify: `src/components/RoutePlanner.js`

**Interfaces:**
- Consumes: `buildRoutePath` output (Task 2) — an array of `[lat, lon]` pairs.
- Produces: `buildGpxString(routeName, path) → string` (pure, tested), `downloadGpx(routeName, path) → void` (side-effecting, triggers a browser download; not unit tested — this matches the existing convention in `src/utils/calendarExport.js`, whose analogous `downloadICS` is likewise untested since it's a thin DOM side-effect wrapper around a tested pure string-builder).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/gpxExport.test.js`:

```js
import { buildGpxString } from './gpxExport';

const PATH = [
  [40.77, -73.97],
  [40.78, -73.96],
];

test('includes the gpx and trk wrapper elements', () => {
  const gpx = buildGpxString('Southern Loop', PATH);
  expect(gpx).toContain('<gpx');
  expect(gpx).toContain('<trk>');
  expect(gpx).toContain('<trkseg>');
});

test('includes one trkpt per coordinate with correct lat/lon', () => {
  const gpx = buildGpxString('Southern Loop', PATH);
  expect(gpx).toContain('lat="40.77" lon="-73.97"');
  expect(gpx).toContain('lat="40.78" lon="-73.96"');
  expect((gpx.match(/<trkpt/g) || []).length).toBe(2);
});

test('escapes special characters in the route name', () => {
  const gpx = buildGpxString('Loop & "Trail" <test>', PATH);
  expect(gpx).toContain('Loop &amp; &quot;Trail&quot; &lt;test&gt;');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/utils/gpxExport.test.js`
Expected: FAIL — `Cannot find module './gpxExport'`.

- [ ] **Step 3: Implement gpxExport.js**

Create `src/utils/gpxExport.js`:

```js
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildGpxString(routeName, path) {
  const trkpts = path.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="centralpark.run" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(routeName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGpx(routeName, path) {
  const gpxString = buildGpxString(routeName, path);
  const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${routeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/utils/gpxExport.test.js`
Expected: all 3 tests pass.

- [ ] **Step 5: Add a "Send to Watch" button per route card**

In `src/components/RoutePlanner.js`, add the import:

```js
import DownloadIcon from '@mui/icons-material/Download';
import { downloadGpx } from '../utils/gpxExport';
```

Inside the route card rendering loop (`routes.map((route, idx) => (...))`), add a button that computes that specific route's path and downloads it. Since `routePath`/`animatedPath` in scope are only for the currently-*selected* card, compute each card's own path inline using `buildRoutePath(route, segmentGeometry)` (already imported from Task 3). Add this button inside the card's second `Box` (the one currently holding the Clear/Event chip), just above the existing chip:

```jsx
<Button
  size="small"
  startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
  onClick={(e) => {
    e.stopPropagation();
    downloadGpx(route.name, buildRoutePath(route, segmentGeometry));
  }}
  sx={{ fontSize: '0.65rem', minWidth: 0, mb: 0.5, textTransform: 'none' }}
>
  GPX
</Button>
```

(`Button` is already imported in `RoutePlanner.js`'s MUI import block from earlier work — if not, add it there.)

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/gpxExport.js src/utils/gpxExport.test.js src/components/RoutePlanner.js
git commit -m "feat: add GPX export button to route cards"
```

---

## Self-Review Notes

- **Spec coverage:** §3.1 (geometry extraction) → Task 1. §3.2 (rendering: real geometry, Carto Positron, route-draw animation, mile markers, direction arrows, start marker) → Tasks 2-4. §3.3 (desktop return) → Task 5. §3.4 (GPX, explicitly optional in spec) → Task 6. All four spec subsections have a corresponding task.
- **Environment risks were verified, not assumed**, before being written into the plan: the Overpass 406/header issue, the exact real OSM names in the bounding box (including that the bridle path is unnamed), the jsdom Leaflet vector-layer crash and its mocking workaround, the `matchMedia` default, the `<Link>`/Router requirement, and the `requestAnimationFrame`/`performance.now()` timescale mismatch under fake timers were all reproduced directly against this repo's actual test environment rather than assumed from general knowledge.
- **Type/interface consistency:** `segmentGeometryMap` shape (`{ id: [[lat,lon],...] }`) is identical across Task 1's output, `routePath.js`'s parameter, and `ParkMap.js`'s import. `ParkMap`'s prop names (`animatedPath`, `affectedSegments`) are introduced once in Task 3 and never renamed in Tasks 4-6. `route.loops[].id`/`.repeat` shape matches the existing, unmodified `routeEngine.js` output.
