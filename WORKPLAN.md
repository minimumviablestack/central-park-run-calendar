# Central Park Run — Improvement Work Plan

> **Goal**: Make centralpark.run indispensable for Central Park runners — useful enough that people share it organically.
>
> **Architecture**: Stay with React SPA (no backend migration). All features below are client-side only.
>
> **Created**: February 15, 2026

---

## Phase 1 — Route Planner (The Killer Feature)

**Why first**: No other app provides loop-aware route planning for Central Park runners. This alone makes the app worth sharing.

### 1.1 Define Segment Data Model

Create a static JSON data file that models Central Park's runnable paths as a graph of segments.

**Segments**:

| ID | Name | Distance (mi) | Surface | Notes |
|----|------|---------------|---------|-------|
| `drive_south` | Southern Drive (59th–72nd) | 1.44 | Asphalt | Flat/rolling |
| `drive_east_mid` | East Drive (72nd–102nd) | 1.75 | Asphalt | Includes Cat Hill |
| `drive_north` | Northern Drive (102nd–110th–102nd) | 1.16 | Asphalt | Steep — Harlem Hill |
| `drive_west_mid` | West Drive (102nd–72nd) | 1.68 | Asphalt | Includes Great Hill descent |
| `transverse_72` | 72nd St Transverse | 0.27 | Asphalt | Flat, connects E/W Drives |
| `transverse_102` | 102nd St Transverse | 0.25 | Asphalt | Flat, connects E/W Drives |
| `reservoir` | Reservoir Track | 1.58 | Crushed gravel | Counterclockwise only, standalone loop |
| `bridle_path` | Bridle Path (Reservoir) | 1.66 | Dirt | Standalone loop around Reservoir |

**Pre-computed Loops**:

| Loop Name | Distance (mi) | Segments |
|-----------|--------------|----------|
| Full Loop | 6.03 | `drive_south` + `drive_east_mid` + `drive_north` + `drive_west_mid` |
| Lower Loop (south of 102nd) | 5.14 | `drive_south` + `drive_east_mid` + `transverse_102` + `drive_west_mid` |
| Upper Loop (north of 72nd) | 4.92 | `transverse_72` + `drive_east_mid` + `drive_north` + `drive_west_mid` |
| Middle Loop (72nd–102nd) | 3.95 | `transverse_72` + `drive_east_mid` + `transverse_102` + `drive_west_mid` |
| Southern Loop (south of 72nd) | 1.71 | `drive_south` + `transverse_72` |
| Northern Loop (north of 102nd) | 1.41 | `drive_north` + `transverse_102` |
| Reservoir | 1.58 | `reservoir` (standalone) |
| Bridle Path | 1.66 | `bridle_path` (standalone) |

**Deliverable**: `src/data/segments.json` containing segments and loop definitions.

**Verification**:
- [ ] All loop distances sum correctly from their constituent segments (within ±0.05mi tolerance)
- [ ] Every segment is used in at least one loop
- [ ] Unit test validates segment distance arithmetic

---

### 1.2 Route Suggestion Engine

Build a pure function that takes a target distance and returns ranked loop combinations.

**User flow**:
1. User selects a distance: 1.5mi / 3mi / 5K / 5mi / 10K / 10mi / Half Marathon
2. Engine returns 2–4 route options, each composed of one or more loops
3. Options are ranked by simplicity (fewer loops = better)
4. Each option shows: total distance, loops included, surface types, elevation profile (flat/hilly)

**Route generation logic**:
- Single loops that match the distance (±0.3mi) come first
- Multi-loop combos: e.g., "Full Loop + Reservoir" = 7.61mi ≈ good for 12K training
- Repeats are valid: "Southern Loop × 2" = 3.42mi ≈ good for 5K
- Cap at 3 loops max per suggestion to keep it practical

**Deliverable**: `src/utils/routeEngine.js` — pure function, no side effects, fully testable.

**Verification**:
- [ ] Unit tests for each preset distance return at least 2 route options
- [ ] No route suggestion exceeds target distance by more than 0.5mi
- [ ] No route suggestion is below target distance by more than 0.3mi
- [ ] Options are sorted by simplicity (single loop > two loops > three loops)
- [ ] Reservoir and Bridle Path are never combined with drive segments in the same loop (they're standalone paths)

---

### 1.3 Event-Aware Route Filtering

Cross-reference route suggestions with today's events from the CSV.

**Logic**:
- Map each event's `LOCATION` field to affected segment IDs (fuzzy matching — "72nd St Transverse" → `transverse_72`, "Central Park" → all drive segments during event hours)
- Tag affected routes with a warning: "⚠ Affected by [Event Name] until [END_TIME]"
- Deprioritize affected routes (sort to bottom) but don't remove them — runner might want to go after the event ends
- Clear routes get a "✓ Clear" badge

**Deliverable**: `src/utils/eventRouteMapping.js` — maps event locations to segment IDs.

**Verification**:
- [ ] Known event locations from current CSV correctly map to segments
- [ ] Events with `LOCATION = "Central Park"` (generic) flag all drive segments
- [ ] Events with specific locations (e.g., "72nd St") flag only relevant segments
- [ ] Routes with no affected segments show as "Clear"
- [ ] Unit tests with mock event data validate the mapping

---

### 1.4 Schematic SVG Map

An illustrated, subway-map-style SVG of Central Park showing all runnable segments.

**Design**:
- Clean vector paths for each segment, color-coded by surface (asphalt = solid, gravel = dashed, dirt = dotted)
- Segments light up (highlight color) when included in a selected route
- Event-affected segments show in orange/red with a pulsing or hatched overlay
- Key landmarks labeled: Columbus Circle, Engineers' Gate, Harlem Meer, Reservoir, Great Lawn
- Compass indicator + distance markers at key points
- Direction arrows showing counterclockwise convention
- Responsive: fills container width, maintains aspect ratio

**Deliverable**: `src/components/ParkMap.js` — React component rendering an inline SVG with dynamic segment highlighting.

**Verification**:
- [ ] All 8 segments are visually distinct and match their real-world relative positions
- [ ] Selecting a route highlights only the correct segments
- [ ] Event-affected segments show warning styling
- [ ] Map renders correctly on mobile (375px width) and desktop (1440px width)
- [ ] No Mapbox/Leaflet dependencies — pure SVG + React
- [ ] Accessibility: each segment has an aria-label with name and distance
- [ ] Visual regression: screenshot comparison on mobile and desktop viewports

---

### 1.5 Route Planner UI Component

Assemble the map, distance selector, and route cards into a cohesive section on the main page.

**Layout**:
- Distance selector: horizontal row of pill buttons (1.5mi / 3mi / 5K / 5mi / 10K / 10mi / Half)
- Below selector: SVG map with active route highlighted
- Below map: 2–4 route option cards showing:
  - Route name (e.g., "Upper Loop")
  - Total distance
  - Surface type chips (Asphalt, Gravel, Dirt)
  - Elevation profile tag (Flat, Rolling, Hilly)
  - Event impact status (Clear ✓ or ⚠ affected)
- Tapping a route card highlights it on the map

**Placement**: Below the Hero Status, above the Weather Widget. This is the primary action area.

**Deliverable**: `src/components/RoutePlanner.js`

**Verification**:
- [ ] Distance selector defaults to no selection (shows map with all segments in neutral color)
- [ ] Selecting a distance shows route cards and highlights first option on map
- [ ] Tapping a different route card updates the map highlight
- [ ] Mobile: distance pills scroll horizontally if needed, route cards stack vertically
- [ ] All MUI components used (no custom HTML/CSS for standard elements)
- [ ] No layout shift when switching between distances
- [ ] Manual test on iOS Safari and Chrome Android (PWA viewport)

---

## Phase 2 — Daily Runner Utility

**Why second**: These features make runners open the app every morning. They're simpler to build and compound the route planner's value.

### 2.1 Sunrise / Sunset Display

**Approach**: Calculate sunrise/sunset using the solar position formula — no API needed. Use Central Park coordinates (40.7812, -73.9665).

**UI**: Two compact chips in the Weather Widget area: "🌅 6:42 AM" and "🌇 5:38 PM". Show "golden hour" window for runners who prefer dawn/dusk.

**Deliverable**: `src/utils/sunCalc.js` + integration into `WeatherWidget.js`

**Verification**:
- [ ] Calculated sunrise/sunset times are within ±2 minutes of timeanddate.com for Central Park on 5 test dates across seasons (equinoxes, solstices, today)
- [ ] Times display correctly in user's local timezone
- [ ] Unit tests for the solar calculation function

---

### 2.2 Air Quality Index (AQI) Badge

**Approach**: Use **Open-Meteo Air Quality API** — free, no API key, CORS-enabled, works client-side.

**Endpoint**: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=40.7790&longitude=-73.9692&current=us_aqi`

**UI**: Color-coded badge next to the weather display:
- 0–50: Green "Good"
- 51–100: Yellow "Moderate"
- 101–150: Orange "Unhealthy (Sensitive)"
- 151–200: Red "Unhealthy"
- 201+: Purple "Very Unhealthy"

Should also affect the HeroStatus recommendation — AQI > 150 should trigger "MAYBE" status with "Air quality is poor" explanation.

**Deliverable**: `src/hooks/useAirQuality.js` + `src/components/AQIBadge.js` + HeroStatus integration

**Verification**:
- [ ] API call succeeds and returns a numeric AQI value
- [ ] Badge color matches EPA AQI category for the returned value
- [ ] AQI > 150 changes HeroStatus to "MAYBE" with air quality warning
- [ ] Graceful fallback if API is down — badge shows "AQI unavailable", does not break the page
- [ ] Unit test for AQI category mapping function
- [ ] No CORS errors in browser console (verify on deployed GitHub Pages, not just localhost)

---

### 2.3 "Best Window to Run" Suggestion

**Approach**: Combine event end times + hourly weather forecast to recommend optimal running windows.

**Logic**:
- Parse hourly forecast from NWS (already fetched by `useWeather`)
- Find windows where: no events active AND temp is 40–80°F AND precip chance < 40%
- Prefer windows of at least 1 hour
- Display as: "Best window: 11 AM – 2 PM (events end at 11, 65°F, clear)"

**UI**: A subtle card between the Hero Status and Route Planner. Only shows when there's a meaningful suggestion (not on perfectly clear days with no events).

**Deliverable**: `src/utils/bestWindow.js` + `src/components/BestWindowCard.js`

**Verification**:
- [ ] On days with events, suggests a window after the last event ends
- [ ] On days with bad weather in the morning, suggests afternoon if forecast improves
- [ ] On perfect days with no events, card is hidden (no noise)
- [ ] Window is at least 1 hour long; shorter windows are not shown
- [ ] Unit tests with mock weather + event data for each scenario above
- [ ] Displayed times are in 12-hour format with AM/PM

---

## Phase 3 — Week View

### 3.1 Week-at-a-Glance Strip

**Why**: Runners plan their week. A 7-day strip showing events + weather lets them pick the best days in 2 seconds.

**UI**: A horizontal strip of 7 day cards (Mon–Sun) showing:
- Day name + date
- Event indicator dot (orange) if events exist that day
- Mini weather icon + high temp (from NWS 7-day forecast, already available)
- AQI dot color
- Tapping a day scrolls to that day's detail or shows a tooltip

**Placement**: Above the "Upcoming Events" list, below the route planner.

**Deliverable**: `src/components/WeekStrip.js`

**Verification**:
- [ ] Shows exactly 7 days starting from today
- [ ] Days with events in CSV show an indicator dot
- [ ] Weather icons and temps match NWS forecast data
- [ ] Current day is visually distinct (highlighted border or background)
- [ ] Responsive: all 7 days visible without horizontal scroll on 375px width
- [ ] Tapping a day with events shows event name(s) (tooltip or expand)
- [ ] If NWS forecast is unavailable, weather portion gracefully degrades

---

## Phase 4 — Shareability

**Why last**: Sharing is only effective when the app is worth sharing. Phases 1–3 make it worth sharing.

### 4.1 Share Button on Hero Status

**Approach**: Use the Web Share API (supported on iOS Safari, Chrome Android — the primary audience). Fallback to clipboard copy on desktop.

**Generated share text** (dynamic based on current state):
- Clear day: "It's a perfect day to run Central Park — 62°F, sunny, no events blocking routes. centralpark.run"
- Event day: "Heads up: [Event Name] in Central Park today until [time]. Upper loop is clear. centralpark.run"
- Bad weather: "Maybe skip Central Park today — 28°F with wind chill. centralpark.run"

**Deliverable**: Share button integrated into `HeroStatus.js`

**Verification**:
- [ ] Web Share API triggers native share sheet on iOS Safari
- [ ] Fallback copies text to clipboard on desktop with "Copied!" confirmation
- [ ] Share text includes current conditions, event status, and the URL
- [ ] Share text is under 280 characters (tweet-friendly)
- [ ] Button is visually integrated with Hero card (not jarring)

---

### 4.2 Calendar Export for Events

**Approach**: Generate `.ics` file content client-side for each event. Two options per event: "Add to Apple Calendar" and "Add to Google Calendar" (Google Calendar uses a URL scheme, no file needed).

**Deliverable**: `src/utils/calendarExport.js` + download/link buttons on event cards.

**Verification**:
- [ ] Downloaded `.ics` file opens correctly in Apple Calendar
- [ ] Google Calendar link opens pre-filled event creation page
- [ ] Event title, date, time, and location are correctly populated
- [ ] Events without `END_TIME` default to 3 hours duration
- [ ] Unit test for `.ics` file generation with all required fields (VCALENDAR, VEVENT, DTSTART, DTEND, SUMMARY, LOCATION)

---

### 4.3 PWA Install Prompt

**Approach**: Listen for the `beforeinstallprompt` event and show a subtle banner after the user's 2nd visit (use localStorage to track visit count).

**UI**: A dismissible banner at the bottom: "Add to Home Screen for quick access" with an install button. Disappears permanently once dismissed or installed.

**Deliverable**: `src/components/InstallPrompt.js` + `useInstallPrompt` hook

**Verification**:
- [ ] Banner does not appear on first visit
- [ ] Banner appears on 2nd visit (or later) if app is not already installed
- [ ] Clicking "Install" triggers the browser's native install flow
- [ ] Dismissing hides the banner permanently (localStorage flag)
- [ ] Banner does not appear if the app is already running in standalone mode
- [ ] Works on Chrome Android; gracefully hidden on browsers that don't support the prompt

---

## Global Verification (Run After Each Phase)

These checks apply after completing any phase:

- [ ] `npm test` passes with no new failures
- [ ] `npm run build` succeeds with no errors
- [ ] `lsp_diagnostics` clean on all changed files (no TypeScript/JSX errors)
- [ ] No new console errors or warnings in browser dev tools
- [ ] Mobile viewport (375px) renders without horizontal scroll or overlapping elements
- [ ] Desktop viewport (1440px) renders without excessive whitespace or misalignment
- [ ] Existing features (Hero Status, Weather, Camera, Event List) are unaffected
- [ ] Performance: Lighthouse score does not drop below 90 on mobile
- [ ] Accessibility: no new ARIA violations (check with axe DevTools or Lighthouse)

---

## Out of Scope (Explicitly Deferred)

| Feature | Reason |
|---------|--------|
| Next.js migration | No feature currently requires a server. Revisit when dynamic OG images or push notifications become a priority. |
| User accounts / login | Adds complexity without proportional value. Preferences use localStorage. |
| Strava / Nike Run Club integration | Requires OAuth and API partnerships. Consider in v3. |
| Multiple camera views | Depends on available NYC DOT camera feeds. Research needed. |
| Crowd density model | Needs historical data we don't have yet. Start collecting data now, build model later. |
| Social features (comments, feed) | Not this app's purpose. Runners have Strava. |
| Push notifications | Requires a service worker push server. Deferred to post-Next.js migration. |

---

## Execution Summary

| Phase | Focus | Key Deliverables | Est. Complexity |
|-------|-------|-----------------|-----------------|
| **1** | Route Planner | Segment data, route engine, SVG map, event-aware filtering, planner UI | High |
| **2** | Daily Utility | Sunrise/sunset, AQI badge, best window suggestion | Medium |
| **3** | Week View | 7-day strip with events + weather + AQI | Medium |
| **4** | Shareability | Share button, calendar export, PWA install prompt | Low–Medium |
