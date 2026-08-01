import { buildRoutePath } from './routePath';
import { haversineMiles } from './geoMath';
import segmentGeometry from '../data/segmentGeometry.json';

const maxConsecutiveGapMi = (path) => {
  let max = 0;
  for (let i = 1; i < path.length; i++) {
    max = Math.max(max, haversineMiles(path[i - 1], path[i]));
  }
  return max;
};

test('returns empty array for a null route', () => {
  expect(buildRoutePath(null, {})).toEqual([]);
});

test('returns a single-segment loop as-is', () => {
  const geo = { reservoir: [[1, 1], [1, 2], [2, 2]] };
  const route = { loops: [{ id: 'reservoir_loop', name: 'Reservoir', repeat: 1 }] };
  expect(buildRoutePath(route, geo)).toEqual([[1, 1], [1, 2], [2, 2]]);
});

test('skips a segment missing from the geometry map without throwing', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, { drive_south: [[1, 1], [2, 2]] });
  expect(result).toEqual([[1, 1], [2, 2]]);
});

test('reverses a segment stored against the walk direction so the path stays continuous', () => {
  // southern_loop = ['drive_south', 'transverse_72']. Both stored A->D here
  // (they do NOT chain head-to-tail as stored); the transverse must be flipped.
  const geo = {
    drive_south: [[0, 0], [1, 0]], // A -> D
    transverse_72: [[0, 0], [1, 0]], // stored A -> D as well
  };
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  // Expect D reached, transverse reversed back to A, shared vertex de-duplicated.
  expect(buildRoutePath(route, geo)).toEqual([[0, 0], [1, 0], [0, 0]]);
});

test('de-duplicates the shared junction vertex between two segments', () => {
  const geo = {
    drive_south: [[0, 0], [1, 0]],
    transverse_72: [[1, 0], [0, 0]], // already head-to-tail (D -> A)
  };
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, geo);
  // [1,0] appears once at the seam, not twice.
  expect(result).toEqual([[0, 0], [1, 0], [0, 0]]);
});

test('real geometry: full_loop draws as one continuous path with no cross-park teleport', () => {
  const route = { loops: [{ id: 'full_loop', name: 'Full Loop', repeat: 1 }] };
  const path = buildRoutePath(route, segmentGeometry);
  expect(path.length).toBeGreaterThan(500);
  // The pre-fix bug left a ~0.34mi (1801ft) straight jump at the
  // drive_south -> drive_east_mid seam. The largest legitimate consecutive
  // gap in the real data is a ~0.16mi sparse-node stretch that OSM itself
  // stores on East Drive, so 0.25mi cleanly separates real from teleport.
  expect(maxConsecutiveGapMi(path)).toBeLessThan(0.25);
});

test('real geometry: southern_loop is continuous (drive_south + reversed transverse_72)', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const path = buildRoutePath(route, segmentGeometry);
  expect(path.length).toBeGreaterThan(100);
  // Pre-fix this seam teleported ~0.43mi (2271ft).
  expect(maxConsecutiveGapMi(path)).toBeLessThan(0.1);
});
