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
