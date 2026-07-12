import { mapEventToSegments, getAffectedSegments } from './eventRouteMapping';

const ALL_DRIVES = [
  'drive_south',
  'drive_east_mid',
  'drive_north',
  'drive_west_mid',
  'transverse_72',
  'transverse_102',
];

test('generic Central Park location maps to all drive segments', () => {
  expect(mapEventToSegments({ LOCATION: 'Central Park' }).sort()).toEqual(
    [...ALL_DRIVES].sort()
  );
});

test('East Drive location maps to drive_east_mid', () => {
  expect(mapEventToSegments({ LOCATION: 'East Drive at 90th St' })).toContain(
    'drive_east_mid'
  );
});

test('reservoir location maps only to reservoir', () => {
  expect(mapEventToSegments({ LOCATION: 'JKO Reservoir' })).toEqual(['reservoir']);
});

test('unknown specific location falls back to all drives', () => {
  expect(mapEventToSegments({ LOCATION: 'Some Unknown Place' }).sort()).toEqual(
    [...ALL_DRIVES].sort()
  );
});

test('getAffectedSegments unions segments across events', () => {
  const events = [
    { LOCATION: 'JKO Reservoir' },
    { LOCATION: 'Bridle Path' },
  ];
  expect(getAffectedSegments(events).sort()).toEqual(['bridle_path', 'reservoir']);
});
