const test = require('node:test');
const assert = require('node:assert');
const { buildWebSearchRequest, extractWebSearchEvents } = require('./webSearch');

const OPTIONS = { today: '2026-10-10', windowDays: 42 };

// Structured (JSON) output carries no url_citation annotations, so consulted
// pages come from the web_search_call actions instead.
function responseWith(events, sourceUrls = []) {
  return {
    status: 'completed',
    output: [
      {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: { type: 'search', queries: ['central park races'], sources: sourceUrls.map((url) => ({ type: 'url', url })) },
      },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify({ events }), annotations: [] }],
      },
    ],
  };
}

function rawEvent(overrides = {}) {
  return {
    name: 'New York City Triathlon',
    date: '2026-10-11',
    startTime: '6:00 AM',
    endTime: null,
    location: 'Central Park, New York',
    description: 'Bike leg on the Central Park loop',
    eventUrl: 'https://nytri.org/race/nyc-triathlon',
    ...overrides,
  };
}

test('buildWebSearchRequest enables web search and states the date window', () => {
  const request = buildWebSearchRequest({ ...OPTIONS, model: 'gpt-6-luna' });
  assert.equal(request.model, 'gpt-6-luna');
  assert.equal(request.tools[0].type, 'web_search');
  assert.deepEqual(request.include, ['web_search_call.action.sources']);
  assert.equal(request.text.format.type, 'json_schema');
  assert.match(request.input, /2026-10-10/);
  assert.match(request.input, /2026-11-21/);
});

test('extractWebSearchEvents maps results to crawler rows tagged websearch', () => {
  const rows = extractWebSearchEvents(
    responseWith([rawEvent()], ['https://nytri.org/?utm_source=chatgpt.com']),
    OPTIONS
  );
  assert.deepEqual(rows, [{
    name: 'New York City Triathlon',
    date: '2026-10-11',
    startTime: '6:00 AM',
    endTime: '',
    location: 'Central Park, New York',
    description: 'Bike leg on the Central Park loop',
    url: 'https://nytri.org/race/nyc-triathlon',
    source: 'websearch',
  }]);
});

test('extractWebSearchEvents accepts sites the model opened during the search', () => {
  const response = responseWith([rawEvent()]);
  response.output.unshift({
    type: 'web_search_call',
    id: 'ws_0',
    status: 'completed',
    action: { type: 'open_page', url: 'https://www.nytri.org/race/nyc-triathlon' },
  });
  assert.equal(extractWebSearchEvents(response, OPTIONS).length, 1);
});

test('extractWebSearchEvents drops events whose site was never cited by a search', () => {
  const rows = extractWebSearchEvents(
    responseWith([rawEvent({ eventUrl: 'https://made-up-race.example/central-park-5k' })], ['https://nytri.org/']),
    OPTIONS
  );
  assert.deepEqual(rows, []);
});

test('extractWebSearchEvents drops events without an event-specific URL', () => {
  const rows = extractWebSearchEvents(
    responseWith(
      [rawEvent({ eventUrl: null }), rawEvent({ eventUrl: 'https://www.nyrr.org/run/race-calendar' })],
      ['https://www.nyrr.org/run/race-calendar']
    ),
    OPTIONS
  );
  assert.deepEqual(rows, []);
});

test('extractWebSearchEvents drops events outside the date window or with bad dates', () => {
  const rows = extractWebSearchEvents(
    responseWith(
      [
        rawEvent({ date: '2026-10-09' }),
        rawEvent({ date: '2026-11-22' }),
        rawEvent({ date: 'October 11' }),
        rawEvent({ date: '2026-02-30' }),
      ],
      ['https://nytri.org/']
    ),
    OPTIONS
  );
  assert.deepEqual(rows, []);
});

test('extractWebSearchEvents returns nothing for incomplete or unparseable responses', () => {
  assert.deepEqual(extractWebSearchEvents({ status: 'incomplete', output: [] }, OPTIONS), []);
  const garbled = responseWith([], ['https://nytri.org/']);
  garbled.output[1].content[0].text = 'not json';
  assert.deepEqual(extractWebSearchEvents(garbled, OPTIONS), []);
});

test('extractWebSearchEvents accepts a single-race site homepage as the event link', () => {
  const rows = extractWebSearchEvents(
    responseWith(
      [rawEvent({ name: 'Big Apple Triathlon', eventUrl: 'https://bigappletriathlon.com/' })],
      ['https://bigappletriathlon.com/']
    ),
    OPTIONS
  );
  assert.equal(rows.length, 1);
});
