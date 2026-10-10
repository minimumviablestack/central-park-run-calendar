const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, isGenericUrl, namesMatch, deduplicateEvents } = require('./events');

test('normalizeUrl ignores scheme, www, trailing slash, case, and tracking params', () => {
  assert.equal(
    normalizeUrl('http://WWW.NYTri.org/race/nyc-triathlon/?utm_source=x&fbclid=y#top'),
    normalizeUrl('https://nytri.org/race/nyc-triathlon')
  );
});

test('normalizeUrl keeps meaningful query params', () => {
  assert.notEqual(
    normalizeUrl('https://example.org/event?id=1'),
    normalizeUrl('https://example.org/event?id=2')
  );
});

test('normalizeUrl returns empty string for missing or invalid URLs', () => {
  assert.equal(normalizeUrl(''), '');
  assert.equal(normalizeUrl(undefined), '');
  assert.equal(normalizeUrl('not a url'), '');
});

test('isGenericUrl flags listing pages used for many events', () => {
  assert.equal(isGenericUrl('https://www.nyrr.org/fullraceyearindex'), true);
  assert.equal(isGenericUrl('https://www.nyrr.org/run/race-calendar'), true);
  assert.equal(isGenericUrl('https://nycruns.com/races'), true);
  assert.equal(isGenericUrl('https://www.nycgovparks.org/parks/central-park/events'), true);
  assert.equal(isGenericUrl('https://nytri.org/new-york-triathlon-3/2025-race-events/'), true);
  assert.equal(isGenericUrl('https://data.cityofnewyork.us/City-Government/Film-Permits/tad4-ftjs'), true);
  assert.equal(isGenericUrl('https://nytri.org/'), true);
  assert.equal(isGenericUrl(''), true);
});

test('isGenericUrl accepts event-specific pages', () => {
  assert.equal(isGenericUrl('https://events.nyrr.org/abbott-dash-to-the-finish-line-5k'), false);
  assert.equal(isGenericUrl('https://www.nycgovparks.org/events/2026/10/10/nyc-triathlon'), false);
});

test('namesMatch ignores organizer prefixes, years, and punctuation', () => {
  assert.equal(namesMatch('NYRR Mini 10K', 'New York Mini 10K!'), true);
  assert.equal(namesMatch('NYC Triathlon', 'New York City Triathlon 2026'), true);
  assert.equal(namesMatch('NYC Tri', 'New York City Triathlon'), true);
  assert.equal(namesMatch('Abbott Dash to the Finish Line 5K', 'Dash to the Finish Line 5K'), true);
});

test('namesMatch rejects different events', () => {
  assert.equal(namesMatch('Race A', 'Race B'), false);
  assert.equal(namesMatch('Mini 10K', 'Mini 5K'), false);
  assert.equal(namesMatch('Run', 'Fun Run 5K'), false);
  assert.equal(namesMatch('NYRR', 'NYC'), false);
});

test('deduplicateEvents keeps the entry with the longer description', () => {
  const result = deduplicateEvents([
    { name: 'NYRR Mini 10K', date: '2026-06-13', description: 'Race', source: 'nyrr' },
    { name: 'New York Mini 10K', date: '2026-06-13', description: 'Historic women-only 10K', source: 'nyc-parks' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].description, 'Historic women-only 10K');
  assert.equal(result[0].source, 'nyc-parks');
});

test('deduplicateEvents leaves distinct events alone', () => {
  const result = deduplicateEvents([
    { name: 'Race A', date: '2026-06-13', description: '' },
    { name: 'Race B', date: '2026-06-13', description: '' },
  ]);
  assert.equal(result.length, 2);
});

test('deduplicateEvents keeps same-named events on different dates', () => {
  const result = deduplicateEvents([
    { name: 'Mini 10K', date: '2026-06-13' },
    { name: 'Mini 10K', date: '2027-06-12' },
  ]);
  assert.equal(result.length, 2);
});

test('deduplicateEvents merges renamed events sharing a specific URL and date', () => {
  const result = deduplicateEvents([
    { name: 'NYC Tri', date: '2026-10-10', url: 'https://nytri.org/race/nyc-triathlon/' },
    { name: 'Olympic Distance Race', date: '2026-10-10', url: 'http://www.nytri.org/race/nyc-triathlon?utm_source=google' },
  ]);
  assert.equal(result.length, 1);
});

test('deduplicateEvents does not merge different events sharing a listing URL and date', () => {
  const result = deduplicateEvents([
    { name: 'Run for the Parks 4M', date: '2025-04-13', url: 'https://www.nyrr.org/fullraceyearindex' },
    { name: 'Spring Kids Mile', date: '2025-04-13', url: 'https://www.nyrr.org/fullraceyearindex' },
    { name: 'Earth Day 5K', date: '2025-04-13', url: 'https://www.nyrr.org/fullraceyearindex' },
  ]);
  assert.equal(result.length, 3);
});

test('deduplicateEvents prefers the entry with a specific URL over a longer description', () => {
  const result = deduplicateEvents([
    { name: 'New York City Triathlon', date: '2026-10-10', description: 'Registration TBD, see race page for details', url: 'https://nytri.org/new-york-triathlon-3/2025-race-events/', source: 'manual' },
    { name: 'NYC Triathlon', date: '2026-10-10', description: 'Triathlon', url: 'https://nytri.org/race/nyc-triathlon', source: 'websearch' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'websearch');
});

test('namesMatch rejects names with different distances or stage numbers', () => {
  assert.equal(
    namesMatch('Health Walk at Run as One Presented by JPMorgan Chase 1.4M', 'Run as One 4M Presented by JPMorgan Chase'),
    false
  );
  assert.equal(
    namesMatch('Girls Run at the Mastercard New York Mini 10K - Stage 2', 'Girls Run at the Mastercard New York Mini 10K - Stage 3'),
    false
  );
});

test('namesMatch rejects a side event held at the main race', () => {
  assert.equal(namesMatch("Rising NYRR at the NYRR Grete's Great Gallop 10K", "NYRR Grete's Great Gallop 10K"), false);
});

test('deduplicateEvents keeps events with different specific pages on the same site', () => {
  const result = deduplicateEvents([
    { name: 'NYRR Washington Heights Salsa, Blues, and Shamrocks 5K', date: '2026-03-01', url: 'https://events.nyrr.org/nyrr-washington-heights-salsa-blues-and-shamrocks-5k' },
    { name: 'Washington Heights Salsa Blues and Shamrocks 5K Kids', date: '2026-03-01', url: 'https://events.nyrr.org/kids-salsa-blues-and-shamrocks' },
  ]);
  assert.equal(result.length, 2);
});

test('deduplicateEvents merges matching names whose specific pages are on different sites', () => {
  const result = deduplicateEvents([
    { name: 'NYRR Mini 10K', date: '2026-06-13', url: 'https://events.nyrr.org/mini-10k' },
    { name: 'New York Mini 10K', date: '2026-06-13', url: 'https://nycruns.com/race/mini-10k' },
  ]);
  assert.equal(result.length, 1);
});
