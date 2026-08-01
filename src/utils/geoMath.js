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
