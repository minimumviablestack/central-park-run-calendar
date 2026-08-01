import { getLoop } from './routeEngine';
import { haversineMiles } from './geoMath';

// Junction points that are the same physical spot are dropped rather than
// duplicated when two segments meet (~26ft covers snapping noise between the
// separate graphs each segment was extracted from).
const JUNCTION_DEDUPE_MI = 0.005;

const endpoints = (coords) => [coords[0], coords[coords.length - 1]];

/**
 * Concatenates a route's loop segments into one continuous coordinate path.
 *
 * Each segment in segmentGeometry.json is stored in a single canonical
 * orientation, but a loop's `segments` array is a logical grouping, not a
 * head-to-tail walk — consecutive segments often share an endpoint that is NOT
 * the tail/head pair (e.g. full_loop lists drive_south (A→D) then
 * drive_east_mid (A→B), which share A, not D→A). Naively pushing coords in
 * stored order therefore teleports across the park at every seam. We orient
 * each segment to chain from the running tail (reversing when its end is nearer
 * than its start) and drop the shared junction vertex, producing a continuous
 * polyline for rendering and GPX export.
 */
export function buildRoutePath(route, segmentGeometryMap) {
  if (!route || !route.loops) return [];

  const segments = [];
  for (const loopEntry of route.loops) {
    const loop = getLoop(loopEntry.id);
    if (!loop) continue;
    for (let rep = 0; rep < loopEntry.repeat; rep++) {
      for (const segId of loop.segments) {
        const coords = segmentGeometryMap[segId];
        if (coords && coords.length) segments.push(coords);
      }
    }
  }

  if (segments.length === 0) return [];
  if (segments.length === 1) return [...segments[0]];

  // Orient the first segment so its END is the junction shared with the second
  // segment (the whole chain hangs off this decision).
  let first = segments[0];
  const [s0, e0] = endpoints(first);
  const [s1, e1] = endpoints(segments[1]);
  const endNearNext = Math.min(haversineMiles(e0, s1), haversineMiles(e0, e1));
  const startNearNext = Math.min(haversineMiles(s0, s1), haversineMiles(s0, e1));
  if (startNearNext < endNearNext) first = [...first].reverse();

  const path = [...first];
  let tail = path[path.length - 1];

  for (let i = 1; i < segments.length; i++) {
    let coords = segments[i];
    const [start, end] = endpoints(coords);
    if (haversineMiles(end, tail) < haversineMiles(start, tail)) {
      coords = [...coords].reverse();
    }
    const dropShared = haversineMiles(coords[0], tail) < JUNCTION_DEDUPE_MI;
    path.push(...(dropShared ? coords.slice(1) : coords));
    tail = path[path.length - 1];
  }

  return path;
}
