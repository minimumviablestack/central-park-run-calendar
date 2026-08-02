import { suggestRoutes, isRouteContinuous, getLoop, getSegment } from './routeEngine';

const combo = (...ids) => ids.map((id) => ({ loop: getLoop(id), repeat: 1 }));

const isStandalone = (loopId) => {
  const loop = getLoop(loopId);
  return loop.segments.length === 1 && getSegment(loop.segments[0]).standalone;
};

const hasStandaloneAndDrive = (route) => {
  const standalone = route.loops.some((l) => isStandalone(l.id));
  const drive = route.loops.some((l) => !isStandalone(l.id));
  return standalone && drive;
};

test('a single loop is continuous', () => {
  expect(isRouteContinuous(combo('full_loop'))).toBe(true);
});

test('two drive loops that share a junction are continuous', () => {
  expect(isRouteContinuous(combo('full_loop', 'southern_loop'))).toBe(true);
});

test('a standalone loop joined to a drive loop is a fly-through and is not continuous', () => {
  expect(isRouteContinuous(combo('reservoir_loop', 'full_loop'))).toBe(false);
  expect(isRouteContinuous(combo('bridle_path_loop', 'full_loop'))).toBe(false);
});

test('two non-adjacent partial loops are not continuous', () => {
  // Southern (bottom of park) + Northern (Harlem Hill) do not connect.
  expect(isRouteContinuous(combo('southern_loop', 'northern_loop'))).toBe(false);
});

test('suggestRoutes never returns a route that flies through (standalone + drive combo)', () => {
  // ~7.6mi is where reservoir(1.58) + full_loop(6.03) used to be suggested.
  const routes = suggestRoutes(7.6, 0.5, []);
  expect(routes.every((r) => !hasStandaloneAndDrive(r))).toBe(true);
});

test('suggestRoutes still returns the full loop for a ~6 mile target', () => {
  const routes = suggestRoutes(6.0, 0.5, []);
  expect(routes.some((r) => r.name === 'Full Loop')).toBe(true);
});

test('standalone loops are still offered on their own', () => {
  const routes = suggestRoutes(1.58, 0.3, []);
  expect(routes.some((r) => r.name === 'Reservoir')).toBe(true);
});

test('half-marathon offers a two-lap-plus-extra route (Full Loop x2 + Southern Loop)', () => {
  const routes = suggestRoutes(13.1, 1.0, []);
  const twoLapPlus = routes.find((r) => {
    const base = r.loops.find((l) => l.repeat >= 2);
    return base && r.loops.length > 1;
  });
  expect(twoLapPlus).toBeDefined();
  // The classic park half shape and it must be continuous (kept by the filter).
  expect(isRouteContinuous(twoLapPlus.loops.map((l) => ({ loop: getLoop(l.id), repeat: l.repeat })))).toBe(true);
});
