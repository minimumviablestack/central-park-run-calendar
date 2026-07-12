const test = require('node:test');
const assert = require('node:assert');
const { normalizeEventKey, deduplicateEvents } = require('./events');

test('normalizeEventKey strips filler words and punctuation', () => {
  assert.equal(
    normalizeEventKey({ name: 'NYRR Mini 10K', date: '2026-06-13' }),
    normalizeEventKey({ name: 'New York Mini 10K!', date: '2026-06-13' })
  );
});

test('normalizeEventKey keeps different dates distinct', () => {
  assert.notEqual(
    normalizeEventKey({ name: 'Mini 10K', date: '2026-06-13' }),
    normalizeEventKey({ name: 'Mini 10K', date: '2027-06-12' })
  );
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
