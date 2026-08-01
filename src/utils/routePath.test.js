import { buildRoutePath } from './routePath';

const FAKE_GEOMETRY = {
  drive_south: [[1, 1], [2, 2]],
  transverse_72: [[2, 2], [3, 3]],
};

test('returns empty array for a null route', () => {
  expect(buildRoutePath(null, FAKE_GEOMETRY)).toEqual([]);
});

test('concatenates a single loop\'s segments in order', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  // southern_loop = ['drive_south', 'transverse_72'] per segments.json
  expect(result).toEqual([[1, 1], [2, 2], [2, 2], [3, 3]]);
});

test('repeats a loop\'s coordinates the given number of times', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 2 }] };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  expect(result).toHaveLength(8);
  expect(result.slice(0, 4)).toEqual(result.slice(4, 8));
});

test('concatenates across multiple loop entries in listed order', () => {
  const route = {
    loops: [
      { id: 'southern_loop', name: 'Southern Loop', repeat: 1 },
      { id: 'southern_loop', name: 'Southern Loop', repeat: 1 },
    ],
  };
  const result = buildRoutePath(route, FAKE_GEOMETRY);
  expect(result).toHaveLength(8);
});

test('skips a segment missing from the geometry map without throwing', () => {
  const route = { loops: [{ id: 'southern_loop', name: 'Southern Loop', repeat: 1 }] };
  const result = buildRoutePath(route, { drive_south: [[1, 1], [2, 2]] });
  expect(result).toEqual([[1, 1], [2, 2]]);
});
