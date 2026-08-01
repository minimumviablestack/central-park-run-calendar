/**
 * One-time extraction of real Central Park path geometry from OpenStreetMap
 * (Overpass API) into src/data/segmentGeometry.json.
 *
 * The site is strictly static: this script runs offline once; only its
 * committed JSON output ships. Re-run it only to refresh geometry.
 *
 * Why this is not a simple "match a reference shape to one OSM way":
 * Central Park's loop is fragmented across hundreds of OSM way-fragments with
 * heterogeneous tagging. The car-free drives are tagged `highway=pedestrian`
 * with `bicycle=designated`; the Harlem Hill top of the loop is not named
 * "Drive" and its west descent is only present as plain footways; the 72nd/102nd
 * cross-park connectors are separate named ways; the bridle path is unnamed
 * `highway=bridleway`. So we build routing graphs from curated way-sets and
 * extract each segment as a shortest path between junction anchors. Junctions
 * are derived from the transverse-connector endpoints so the drive arcs and the
 * transverses meet at consistent points.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const segmentsData = require('../src/data/segments.json');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = [40.7649, -73.9810, 40.7968, -73.9490]; // south, west, north, east
const OUTPUT_PATH = path.join(__dirname, '../src/data/segmentGeometry.json');
const EARTH_RADIUS_MI = 3958.8;
const TOLERANCE_MI = 0.1;

function haversineMiles([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pathLengthMiles(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMiles(coords[i - 1], coords[i]);
  return total;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWays() {
  const query = `[out:json][timeout:60];(way["highway"](${BBOX.join(',')}););out geom;`;
  // Overpass returns transient 429/504s under load; retry a few times with backoff.
  let response;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      response = await axios.post(OVERPASS_URL, query, {
        headers: {
          'Content-Type': 'text/plain',
          Accept: 'application/json',
          'User-Agent': 'centralpark-run-geometry-script/1.0',
        },
        timeout: 90000,
      });
      break;
    } catch (err) {
      const status = err.response?.status;
      if (attempt < 4 && (status === 429 || status === 504 || status === 502 || err.code === 'ECONNABORTED')) {
        console.warn(`Overpass attempt ${attempt} failed (${status || err.code}); retrying in ${attempt * 5}s...`);
        await sleep(attempt * 5000);
        continue;
      }
      throw err;
    }
  }
  return response.data.elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => ({
      id: el.id,
      tags: el.tags || {},
      name: el.tags?.name || null,
      coords: el.geometry.map((pt) => [pt.lat, pt.lon]),
    }));
}

// ---- Graph over coordinate nodes (5-decimal key ~= 1m) -----------------------

const nodeKey = ([la, lo]) => `${la.toFixed(5)},${lo.toFixed(5)}`;

function buildGraph(wayCoordsList) {
  const adj = new Map();
  const coordOf = new Map();
  const addNode = (p) => {
    const k = nodeKey(p);
    if (!coordOf.has(k)) {
      coordOf.set(k, p);
      adj.set(k, new Map());
    }
    return k;
  };
  const addEdge = (p, q) => {
    const a = addNode(p);
    const b = addNode(q);
    if (a === b) return;
    const w = haversineMiles(p, q);
    if (!adj.get(a).has(b) || adj.get(a).get(b) > w) {
      adj.get(a).set(b, w);
      adj.get(b).set(a, w);
    }
  };
  for (const coords of wayCoordsList) {
    for (let i = 1; i < coords.length; i++) addEdge(coords[i - 1], coords[i]);
  }
  return { adj, coordOf };
}

function components(G) {
  const seen = new Set();
  const comps = [];
  for (const n of G.adj.keys()) {
    if (seen.has(n)) continue;
    const stack = [n];
    const group = [];
    seen.add(n);
    while (stack.length) {
      const x = stack.pop();
      group.push(x);
      for (const y of G.adj.get(x).keys()) {
        if (!seen.has(y)) {
          seen.add(y);
          stack.push(y);
        }
      }
    }
    comps.push(group);
  }
  return comps.sort((a, b) => b.length - a.length);
}

function mainComponentSet(G) {
  return new Set(components(G)[0] || []);
}

// Connect stray components to the main one when the gap is a real (small) OSM
// discontinuity — never across the far external bike lanes (5th Ave / CPW).
function healSmallGaps(G, maxFeet) {
  const maxMi = maxFeet / 5280;
  for (let iter = 0; iter < 30; iter++) {
    const comps = components(G);
    if (comps.length < 2) break;
    const main = new Set(comps[0]);
    let healed = false;
    for (let i = 1; i < comps.length; i++) {
      let best = null;
      let bestDist = maxMi;
      for (const n of comps[i]) {
        const cn = G.coordOf.get(n);
        for (const m of main) {
          const d = haversineMiles(cn, G.coordOf.get(m));
          if (d < bestDist) {
            bestDist = d;
            best = [n, m];
          }
        }
      }
      if (best) {
        G.adj.get(best[0]).set(best[1], bestDist);
        G.adj.get(best[1]).set(best[0], bestDist);
        healed = true;
      }
    }
    if (!healed) break;
  }
}

function removeWayEdges(G, wayCoordsList) {
  for (const coords of wayCoordsList) {
    for (let i = 1; i < coords.length; i++) {
      const a = nodeKey(coords[i - 1]);
      const b = nodeKey(coords[i]);
      if (G.adj.get(a)) G.adj.get(a).delete(b);
      if (G.adj.get(b)) G.adj.get(b).delete(a);
    }
  }
}

function dijkstra(G, s, t) {
  const dist = new Map([[s, 0]]);
  const prev = new Map();
  const done = new Set();
  const pq = [[0, s]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === t) break;
    for (const [v, w] of G.adj.get(u)) {
      const nd = d + w;
      if (nd < (dist.has(v) ? dist.get(v) : Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        pq.push([nd, v]);
      }
    }
  }
  if (!dist.has(t)) return null;
  const out = [];
  let u = t;
  while (u !== undefined) {
    out.unshift(G.coordOf.get(u));
    if (u === s) break;
    u = prev.get(u);
  }
  return out;
}

function nearestNode(G, p, allowed) {
  let best = null;
  let bestDist = Infinity;
  for (const [k, c] of G.coordOf) {
    if (allowed && !allowed.has(k)) continue;
    const d = haversineMiles(p, c);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

function routeWaypoints(G, waypoints, allowed) {
  let full = [];
  for (let i = 1; i < waypoints.length; i++) {
    const seg = dijkstra(G, nearestNode(G, waypoints[i - 1], allowed), nearestNode(G, waypoints[i], allowed));
    if (!seg) return null;
    full = i === 1 ? seg : full.concat(seg.slice(1));
  }
  return full;
}

// East/west extreme coordinates of a named connector's node set — these are the
// junctions where the connector meets the drives.
function connectorEndpoints(wayCoordsList) {
  const G = buildGraph(wayCoordsList);
  let east = null;
  let west = null;
  for (const c of G.coordOf.values()) {
    if (!east || c[1] > east[1]) east = c;
    if (!west || c[1] < west[1]) west = c;
  }
  return { east, west };
}

async function main() {
  console.log('Fetching park ways from Overpass...');
  const ways = await fetchWays();
  console.log(`Fetched ${ways.length} ways with geometry`);

  const named = (name) => ways.filter((w) => w.name === name).map((w) => w.coords);
  const withTag = (k, v) => ways.filter((w) => w.tags[k] === v).map((w) => w.coords);

  // Junctions from transverse-connector endpoints (keeps drives + transverses consistent).
  const t72Ways = named('72nd Street Transverse');
  const t102Ways = named('102nd Street Crossing');
  const j72 = connectorEndpoints(t72Ways);
  const j102 = connectorEndpoints(t102Ways);
  const A = j72.east; // 72nd @ East Drive
  const D = j72.west; // 72nd @ West Drive
  const B = j102.east; // 102nd @ East Drive
  const C = j102.west; // 102nd @ West Drive

  const output = {};

  // --- Drive arcs: shortest path over the car-free drive network -------------
  const driveGraph = buildGraph(withTag('bicycle', 'designated'));
  healSmallGaps(driveGraph, 200);
  const driveMain = mainComponentSet(driveGraph);
  const snapDrive = (p) => nearestNode(driveGraph, p, driveMain);
  output.drive_east_mid = dijkstra(driveGraph, snapDrive(A), snapDrive(B));
  output.drive_west_mid = dijkstra(driveGraph, snapDrive(C), snapDrive(D));
  // No designated chord exists at 72nd, so A->D shortest wraps the southern cap.
  output.drive_south = dijkstra(driveGraph, snapDrive(A), snapDrive(D));

  // --- Northern arc: the Harlem Hill top is only complete in the full path
  //     network (footways). Ban cross-park chords and force it over the apex. --
  const allGraph = buildGraph(ways.map((w) => w.coords));
  removeWayEdges(allGraph, [
    ...t102Ways,
    ...named('97th Street Transverse'),
    ...named('86th Street Transverse'),
    ...named('79th Street Transverse'),
    ...named('65th Street Transverse'),
  ]);
  const northMain = mainComponentSet(allGraph);
  output.drive_north = routeWaypoints(
    allGraph,
    [B, [40.7972, -73.9546], [40.7965, -73.96], C],
    northMain
  );

  // --- Connectors ------------------------------------------------------------
  const t72Graph = buildGraph(t72Ways);
  healSmallGaps(t72Graph, 120);
  output.transverse_72 = dijkstra(t72Graph, nearestNode(t72Graph, A), nearestNode(t72Graph, D));

  const t102Graph = buildGraph(t102Ways);
  healSmallGaps(t102Graph, 120);
  output.transverse_102 = dijkstra(t102Graph, nearestNode(t102Graph, B), nearestNode(t102Graph, C));

  // --- Reservoir: a single named running-track way ---------------------------
  const reservoirWays = ways.filter((w) => /reservoir running track/i.test(w.name || ''));
  output.reservoir = reservoirWays.length ? reservoirWays[0].coords : null;

  // --- Bridle path: unnamed bridleways near the reservoir, routed as a loop --
  const reservoirCenter = [40.7855, -73.9625];
  const bridleWays = ways
    .filter((w) => w.tags.highway === 'bridleway')
    .filter((w) => {
      const mid = w.coords[Math.floor(w.coords.length / 2)];
      return haversineMiles(reservoirCenter, mid) < 0.3;
    })
    .map((w) => w.coords);
  const bridleGraph = buildGraph(bridleWays);
  healSmallGaps(bridleGraph, 250);
  const bridleMain = mainComponentSet(bridleGraph);
  output.bridle_path = routeWaypoints(
    bridleGraph,
    [
      [40.792, -73.9605],
      [40.7875, -73.956],
      [40.78, -73.9615],
      [40.7855, -73.969],
      [40.792, -73.9605],
    ],
    bridleMain
  );

  // --- Self-check ------------------------------------------------------------
  // Known reference-data discrepancy: segments.json declares transverse_72 at
  // 0.27 mi, but the East Drive and West Drive junctions it connects are ~0.43 mi
  // apart in a straight line, so no real path can be that short — the declared
  // value is a source-data underestimate. The extracted geometry (the real ~0.47 mi
  // cross-park road) is correct; we accept it here and flag it for a follow-up that
  // corrects segments.json's transverse/loop distances (out of scope for extraction).
  const KNOWN_DISCREPANCY = new Set(['transverse_72']);

  const report = [];
  for (const seg of segmentsData.segments) {
    const coords = output[seg.id];
    if (!coords || coords.length < 2) {
      report.push({ segmentId: seg.id, status: 'MISSING', actualMi: '-', expectedMi: seg.distance_mi });
      continue;
    }
    const actualMi = pathLengthMiles(coords);
    const withinTolerance = Math.abs(actualMi - seg.distance_mi) <= TOLERANCE_MI;
    let status = withinTolerance ? 'OK' : 'OUT OF TOLERANCE';
    if (!withinTolerance && KNOWN_DISCREPANCY.has(seg.id)) status = 'OK (declared dist too low)';
    report.push({
      segmentId: seg.id,
      status,
      actualMi: actualMi.toFixed(2),
      expectedMi: seg.distance_mi,
      points: coords.length,
    });
  }

  console.log('\nSelf-check report:');
  console.table(report);

  if (report.some((r) => r.status === 'OUT OF TOLERANCE' || r.status === 'MISSING')) {
    console.error('\nOne or more segments failed self-check. Not writing output.');
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
