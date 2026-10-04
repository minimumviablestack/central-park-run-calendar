import { buildEventsStructuredData } from './structuredData';

const BASE_EVENT = {
  EVENT_NAME: 'NYRR Fred Lebow Half Marathon',
  DATE: '2026-01-26',
  START_TIME: '8:00 AM',
  END_TIME: '11:00 AM',
  LOCATION: 'Central Park',
  DESCRIPTION: 'A half marathon in Central Park.',
  URL: 'https://www.nyrr.org/races/fredlebowhalfmarathon',
};

test('returns null for no events', () => {
  expect(buildEventsStructuredData([])).toBeNull();
  expect(buildEventsStructuredData(null)).toBeNull();
});

test('builds a schema.org graph with one SportsEvent node per event', () => {
  const data = buildEventsStructuredData([BASE_EVENT]);
  expect(data['@context']).toBe('https://schema.org');
  expect(data['@graph']).toHaveLength(1);

  const node = data['@graph'][0];
  expect(node['@type']).toBe('SportsEvent');
  expect(node.name).toBe(BASE_EVENT.EVENT_NAME);
  expect(node.description).toBe(BASE_EVENT.DESCRIPTION);
  expect(node.url).toBe(BASE_EVENT.URL);
  expect(node.location.name).toBe('Central Park');
});

test('produces an ISO 8601 startDate/endDate with the NYC offset', () => {
  const [node] = buildEventsStructuredData([BASE_EVENT])['@graph'];
  // Jan 26 is EST (UTC-5), not EDT -- regression check for DST handling.
  expect(node.startDate).toBe('2026-01-26T08:00:00-05:00');
  expect(node.endDate).toBe('2026-01-26T11:00:00-05:00');
});

test('applies the NYC daylight-saving offset for summer dates', () => {
  const [node] = buildEventsStructuredData([
    { ...BASE_EVENT, DATE: '2026-07-04', START_TIME: '8:00 AM', END_TIME: '' },
  ])['@graph'];
  expect(node.startDate).toBe('2026-07-04T08:00:00-04:00');
});

test('falls back to 9am start and omits endDate when times are missing', () => {
  const [node] = buildEventsStructuredData([
    { ...BASE_EVENT, START_TIME: '', END_TIME: '' },
  ])['@graph'];
  expect(node.startDate).toBe('2026-01-26T09:00:00-05:00');
  expect(node.endDate).toBeUndefined();
});

test('omits description and url when absent', () => {
  const [node] = buildEventsStructuredData([
    { ...BASE_EVENT, DESCRIPTION: '', URL: '' },
  ])['@graph'];
  expect(node.description).toBeUndefined();
  expect(node.url).toBeUndefined();
});

test('handles the inconsistent time formats seen in data/events.csv without throwing', () => {
  // Real crawler output mixes these shapes: "8:00 AM", "9:15 a.m.", "08:00".
  const messyTimes = ['9:15 a.m.', '8:00 a.m.', '08:00', ''];
  for (const time of messyTimes) {
    expect(() => buildEventsStructuredData([{ ...BASE_EVENT, START_TIME: time, END_TIME: time }])).not.toThrow();
  }
});

test('falls back to the default hour for an unparseable time instead of an invalid date', () => {
  const [node] = buildEventsStructuredData([
    { ...BASE_EVENT, START_TIME: 'not a time', END_TIME: '' },
  ])['@graph'];
  expect(node.startDate).toBe('2026-01-26T09:00:00-05:00');
});

test('skips events missing a name or date', () => {
  const data = buildEventsStructuredData([
    { ...BASE_EVENT, EVENT_NAME: '' },
    { ...BASE_EVENT, DATE: '' },
  ]);
  expect(data).toBeNull();
});
