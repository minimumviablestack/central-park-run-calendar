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
