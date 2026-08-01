import { haversineMiles } from './geoMath';

// Two segment endpoints closer than this are treated as the same junction:
// the shared vertex is dropped rather than duplicated when they are joined.
const JUNCTION_DEDUPE_MI = 0.005;

const endpoints = (coords) => [coords[0], coords[coords.length - 1]];

/**
 * Chain an ordered list of segment coordinate arrays into one polyline.
 *
 * Each segment is stored in a single canonical orientation, but the order it
 * is requested in is a logical grouping, not a head-to-tail walk — so each
 * segment after the first is reversed when its end is nearer the running tail
 * than its start, and the shared junction vertex is de-duplicated.
 *
 * Returns both the joined `path` and `maxSeamGapMi` — the largest gap
 * introduced at a seam (a join between two segments). Gaps *within* a single
 * segment's own geometry are not counted, so callers can distinguish a genuine
 * "fly-through" between non-adjacent pieces from harmless sparse source data.
 */
export function chainSegments(coordArrays) {
  const segments = coordArrays.filter((c) => c && c.length);
  if (segments.length === 0) return { path: [], maxSeamGapMi: 0 };
  if (segments.length === 1) return { path: [...segments[0]], maxSeamGapMi: 0 };

  // Orient the first segment so its END is the junction shared with the second.
  let first = segments[0];
  const [s0, e0] = endpoints(first);
  const [s1, e1] = endpoints(segments[1]);
  const endNearNext = Math.min(haversineMiles(e0, s1), haversineMiles(e0, e1));
  const startNearNext = Math.min(haversineMiles(s0, s1), haversineMiles(s0, e1));
  if (startNearNext < endNearNext) first = [...first].reverse();

  const path = [...first];
  let tail = path[path.length - 1];
  let maxSeamGapMi = 0;

  for (let i = 1; i < segments.length; i++) {
    let coords = segments[i];
    const [start, end] = endpoints(coords);
    if (haversineMiles(end, tail) < haversineMiles(start, tail)) {
      coords = [...coords].reverse();
    }
    const seamGap = haversineMiles(coords[0], tail);
    if (seamGap > maxSeamGapMi) maxSeamGapMi = seamGap;
    const dropShared = seamGap < JUNCTION_DEDUPE_MI;
    path.push(...(dropShared ? coords.slice(1) : coords));
    tail = path[path.length - 1];
  }

  return { path, maxSeamGapMi };
}
