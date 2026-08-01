import { getLoop } from './routeEngine';
import { chainSegments } from './routeContinuity';

/**
 * Concatenates a route's loop segments into one continuous coordinate path,
 * orienting each segment head-to-tail and de-duplicating shared junctions
 * (see routeContinuity.chainSegments). A loop's `segments` array is a logical
 * grouping, not a walk order, so naive concatenation would teleport at seams.
 */
export function buildRoutePath(route, segmentGeometryMap) {
  if (!route || !route.loops) return [];

  const coordArrays = [];
  for (const loopEntry of route.loops) {
    const loop = getLoop(loopEntry.id);
    if (!loop) continue;
    for (let rep = 0; rep < loopEntry.repeat; rep++) {
      for (const segId of loop.segments) {
        const coords = segmentGeometryMap[segId];
        if (coords && coords.length) coordArrays.push(coords);
      }
    }
  }

  return chainSegments(coordArrays).path;
}
