import { chainSegments } from './routeContinuity';
import { haversineMiles } from './geoMath';

test('empty input yields empty path and zero gap', () => {
  expect(chainSegments([])).toEqual({ path: [], maxSeamGapMi: 0 });
});

test('a single segment passes through unchanged with zero seam gap', () => {
  const seg = [[1, 1], [1, 2], [2, 2]];
  expect(chainSegments([seg])).toEqual({ path: seg, maxSeamGapMi: 0 });
});

test('reverses a segment stored against the walk direction and de-dupes the junction', () => {
  // Both stored starting at [0,0]; they share [1,0] once oriented.
  const result = chainSegments([
    [[0, 0], [1, 0]],
    [[0, 0], [1, 0]],
  ]);
  expect(result.path).toEqual([[0, 0], [1, 0], [0, 0]]);
  expect(result.maxSeamGapMi).toBeLessThan(0.005);
});

test('reports the seam gap between two non-adjacent segments', () => {
  // Second segment starts ~1 degree of latitude (~69mi) from the first's end.
  const result = chainSegments([
    [[40.0, -73.0], [40.01, -73.0]],
    [[41.0, -73.0], [41.01, -73.0]],
  ]);
  const expectedGap = haversineMiles([40.01, -73.0], [41.0, -73.0]);
  expect(result.maxSeamGapMi).toBeCloseTo(expectedGap, 5);
  expect(result.maxSeamGapMi).toBeGreaterThan(60);
});

test('a gap inside one segment is not counted as a seam gap', () => {
  // One segment with a big internal jump; no seam between segments exists.
  const result = chainSegments([[[40.0, -73.0], [41.0, -73.0]]]);
  expect(result.maxSeamGapMi).toBe(0);
});
