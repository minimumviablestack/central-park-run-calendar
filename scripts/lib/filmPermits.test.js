const test = require('node:test');
const assert = require('node:assert');
const { transformFilmPermits, formatSocrataTime } = require('./filmPermits');

test('formatSocrataTime converts to 12-hour format without timezone shifts', () => {
  assert.equal(formatSocrataTime('2026-07-15T06:00:00.000'), '6:00 AM');
  assert.equal(formatSocrataTime('2026-07-15T14:30:00.000'), '2:30 PM');
  assert.equal(formatSocrataTime('2026-07-15T00:15:00.000'), '12:15 AM');
  assert.equal(formatSocrataTime(''), '');
});

test('permits held inside Central Park are transformed', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    category: 'Television',
    startdatetime: '2026-07-15T06:00:00.000',
    enddatetime: '2026-07-15T20:00:00.000',
    parkingheld: 'WEST DRIVE (CENTRAL PARK) between TERRACE DRIVE and 72 STREET',
  }];
  const events = transformFilmPermits(rows);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'Film shoot: Television');
  assert.equal(events[0].date, '2026-07-15');
  assert.equal(events[0].startTime, '6:00 AM');
  assert.equal(events[0].endTime, '8:00 PM');
  assert.equal(events[0].source, 'film-permits');
});

test('Central Park West avenue permits are excluded', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    category: 'Film',
    startdatetime: '2026-07-15T06:00:00.000',
    parkingheld: 'CENTRAL PARK WEST between W 81 ST and W 84 ST',
  }];
  assert.equal(transformFilmPermits(rows).length, 0);
});

test('rows without startdatetime are excluded', () => {
  const rows = [{
    eventtype: 'Shooting Permit',
    parkingheld: 'WEST DRIVE (CENTRAL PARK)',
  }];
  assert.equal(transformFilmPermits(rows).length, 0);
});
