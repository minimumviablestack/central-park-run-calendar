# centralpark.run — Site Polish & Monetization-Ready Design

**Date:** 2026-07-09
**Status:** Approved
**Scope:** Polish phase. Distribution/outreach is explicitly ON HOLD until this phase ships.

## Context & Goals

- Site: single-page static React utility on GitHub Pages (stays static, stays free).
- Traffic: under ~500 users/month. Growth work is limited to passive discoverability (SEO); active distribution is deferred.
- Audience focus: runners who want to run **the park loop and running routes** — today or this week. Not general park-event listings.
- Monetization: affiliate links, local sponsorship, tip jar. No display ads. Traffic-gated rollout; groundwork only for now.
- Hosting decision: stay on GitHub Pages. Every feature below is a build-time artifact or client-side logic; nothing needs a server. Revisit only if push notifications or per-user accounts are ever planned.

## 1. Technical SEO & Indexability

The built page ships an empty `<div id="root">` and a generic title. Fix at build time — `events.csv` is available then.

New post-build script `scripts/generateSeo.js` (runs after `react-scripts build`, alongside the existing `cp -r data build/`) injects into `build/index.html`:

- **JSON-LD structured data**: one `SportsEvent` object per upcoming event (name, startDate, location "Central Park, New York, NY") plus a `WebApplication` object for the site. Makes races eligible for Google event rich results — the biggest search-visibility win available without adding pages.
- **Static pre-render block inside `#root`**: headline, one-paragraph description, and the upcoming-events list as plain HTML. React replaces it on mount; crawlers and link-preview bots see real content.
- **Keyword-bearing title/meta**: e.g. "Central Park Running — Today's Events, Weather & Route Planner". Refresh OG/Twitter descriptions to match.
- `sitemap.xml` and `robots.txt` in `public/`.

One-time manual step (owner): register the site with Google Search Console — also reveals what queries already rank.

## 2. Data Depth — Route-Impacting Events Only

The site answers one question: **"can I run my loop right now?"** The crawler should capture only events that occupy runnable segments.

- **In scope:** NYRR and other running races, bike races, charity walks on the drives, parades/marches routed through the park, large events that close drive sections, film shoots occupying the loop.
- **Out of scope:** museum events, playground programs, birdwalks — anything not touching a runnable segment.
- Expand `scripts/crawlEventsSmart.js` with additional free public sources (NYC Parks special events, street-activity permits, Central Park Conservancy calendar, film-shoot permits via NYC Open Data), then apply a **route-impact filter**: location/permit-type matching against the 8 segments in `src/data/segments.json`.
- Add a `SOURCE` column to `events.csv` and de-duplication across sources. Each event keeps its segment mapping — this feeds the existing warning badges and the alternatives feature (§4).
- Switch `.github/workflows/update-events.yml` from weekly to **daily** so data, JSON-LD, and the .ics feed never look stale. Still free within Actions limits.

## 3. Interactive Route Map (flagship polish item)

**History:** a react-leaflet map already exists (`src/components/ParkMap.js`) but polylines were hand-sketched ~5-point approximations that didn't follow the drives, so `showRoutes = false` was set and the planner was hidden to the mobile Plan tab. The map library is fine; the geometry was the problem.

### 3.1 Geometry extraction (one-time script)

- `scripts/extractGeometry.js` queries the **Overpass API** (OpenStreetMap, free) for the park's named ways: East Drive, West Drive, Center Drive, 72nd St Cross Drive, 102nd St Crossing, the reservoir running track, and the bridle path.
- Stitch/split results into the existing 8 segment IDs; write `src/data/segmentGeometry.json` — dense polylines (hundreds of points) that hug the actual roads.
- **Self-check:** haversine length of each polyline must match the distance in `segments.json` within ±0.1 mi; fail the script otherwise.
- Runs once; the app ships the JSON. No runtime dependency; site stays static.
- Fallback if Overpass stitching is fiddly: trace segments once in geojson.io over satellite imagery.

### 3.2 Map rendering

- Flip `showRoutes` back on with real geometry; keep the existing highlight/affected styling logic.
- Swap OSM default tiles for **Carto Positron** (free, no API key) — light desaturated basemap where the park reads green and route lines pop.
- **Route-draw animation:** when the user picks a distance and route card, the polyline animates along its path (snake animation stepping through the coordinate array, ~1.5 s).
- Route dressing computed from the geometry: start marker at the suggested entrance, direction arrows (counterclockwise convention), mile markers at each cumulative mile. Event-affected segments keep the orange dashed overlay.

### 3.3 Desktop return

Two-column desktop layout: sticky map left, distance pills + route cards right. Mobile keeps the Plan tab (map above cards). The planner is the site's most differentiated feature; hiding it on desktop was a workaround for broken geometry.

### 3.4 GPX export (optional bonus)

"Send to watch" button per route generating a GPX file client-side from the same polylines. Cheap once geometry exists; very shareable.

## 4. Sticky Features

- **"Park occupied? Run here instead"** — when events block most/all of the loop (or all routes at the user's target distance are affected), the route planner and hero status offer alternatives: in-park fallbacks first (e.g. reservoir/bridle combos if clear), then nearby options — Riverside Park loop (~3 mi), Hudson River Greenway segments. Implementation: `src/data/alternatives.json` (name, distance, surface, directions-from-park, Google Maps link) + trigger logic that fires only when park routes are meaningfully blocked. In-app card — no new pages.
- **Subscribable calendar feed** — generate `events.ics` at build time (reusing `src/utils/calendarExport.js` logic), host statically; "Subscribe" button uses `webcal://centralpark.run/data/events.ics`. Refreshed by daily CI. Retention hook that works even if users never revisit.
- **"What to wear" card** — map current NWS conditions (already fetched by `useWeather`) to runner apparel guidance ("38°F + wind: gloves, long sleeves, light jacket"). Daily-useful now; the natural future home for affiliate links.
- Minor: sharpen the share-button text to include the value proposition.

## 5. About Page Redesign — Monetization-Ready Slots

**Goal:** every current and future monetization surface is a config-driven *slot*; adding an affiliate, sponsor, or tip option is a one-line JSON change.

Page structure (top → bottom):

1. **Header** — logo, title, back button (tidied).
2. **Mission card** — current story compressed to 2–3 sentences.
3. **"How it works" strip** — three icon tiles: *Events aggregated daily* · *AI-parsed from public sources* · *Free, no accounts*.
4. **Support section** — responsive card grid (2-col desktop, 1-col mobile) rendered from new `src/data/support.json`. Entry shape: `{ id, type, title, description, icon, url, chip? }`, `type ∈ link | affiliate | tip | sponsor`:
   - `link` → GitHub star, feedback, share (kept).
   - `affiliate` → Soar referral today; future programs are one JSON entry each. Cards carry a "Referral" chip — disclosure handled once in the card component.
   - `tip` → ETH address with **copy-to-clipboard + snackbar**, replacing the MetaMask `alert()` flow (jarring; breaks without MetaMask). Buy Me a Coffee drops in later as another entry.
5. **Sponsor slot** — reserved "Supported by" band from the same config. Empty state: subtle outlined card "Sponsor centralpark.run — reach NYC runners" linking to owner email. A landed sponsor is one JSON entry (logo + blurb). The visible slot quietly advertises availability.
6. **Disclaimer** — kept, restyled as compact footnote.

### Monetization sequencing (traffic-gated)

| Stage | Action |
|---|---|
| Now | Tip jar entries (crypto copy-to-clipboard; Buy Me a Coffee / GitHub Sponsors), footer + About only |
| ~2–5K users/mo | Affiliate links inside the what-to-wear card (running-retailer programs preferred over Amazon; disclosure line) |
| ~5K+ users/mo | One "Supported by ___" sponsor; outreach one-pager ($100–300/mo, local running store / PT clinic) |

## 6. Distribution — ON HOLD (appendix)

Deferred until polish ships. Ready-to-go playbook for later: intro posts for r/RunNYC and r/nyc, pitch messages for NYC run-club organizers and running stores, submissions to running-tool directories/newsletters, and answering "is Central Park closed for the race?" threads with the link. No paid promotion.

## 7. Measurement

- GA4 events on key actions: route planned, calendar subscribed, alternative-route viewed, share tapped, GPX exported.
- Monthly Search Console review once registered.
- Polish-phase success bar: calendar-feed subscribers and returning-user rate trending up. Absolute traffic targets (~2K users/mo) belong to the distribution phase.

## Build Order

1. Data scope (route-impacting filter, sources, `SOURCE` column) + daily CI
2. SEO injection (`generateSeo.js`, JSON-LD, static block, sitemap/robots)
3. Interactive route map (geometry extraction → rendering → desktop return → GPX)
4. Alternatives card
5. `events.ics` subscribable feed
6. What-to-wear card
7. About page redesign + tip jar slots

## Out of Scope

- New content/guide pages (owner decision — single-page utility stays)
- Display ads
- Backend/hosted migration, push notifications, user accounts
- Active distribution/outreach (on hold, see §6)
