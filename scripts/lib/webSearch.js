const dayjs = require('dayjs');
const { normalizeUrl, isGenericUrl } = require('./events');

const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          date: { type: 'string', description: 'Event date in YYYY-MM-DD format' },
          startTime: { type: 'string' },
          endTime: { type: ['string', 'null'] },
          location: { type: 'string' },
          description: { type: ['string', 'null'] },
          eventUrl: { type: ['string', 'null'], description: "Link to the event's own page (not a calendar or listing page)" },
        },
        required: ['name', 'date', 'startTime', 'endTime', 'location', 'description', 'eventUrl'],
        additionalProperties: false,
      },
    },
  },
  required: ['events'],
  additionalProperties: false,
};

function windowEnd(today, windowDays) {
  return dayjs(today).add(windowDays, 'day').format('YYYY-MM-DD');
}

function buildWebSearchRequest({ today, windowDays, model }) {
  const end = windowEnd(today, windowDays);
  return {
    model,
    tools: [{
      type: 'web_search',
      user_location: { type: 'approximate', city: 'New York', region: 'New York', country: 'US', timezone: 'America/New_York' },
    }],
    include: ['web_search_call.action.sources'],
    input: `Search the web for events held in Central Park, New York City between ${today} and ${end} (inclusive) ` +
      'that use the park drives or loop roads: running races, triathlons, duathlons, charity walks, bike rides, parades, ' +
      'and large events that close park roads. Check race organizers (e.g. NYRR, NYCRUNS, New York Triathlon Club), ' +
      'NYC Parks, and local news. Only include events you found on a web page during this search, with a link to that ' +
      "event's own page. Do not include events outside Central Park or outside the date range.",
    text: { format: { type: 'json_schema', name: 'central_park_events', strict: true, schema: EVENT_SCHEMA } },
  };
}

// events.nyrr.org and nyrr.org belong to the same site.
function siteOf(url) {
  return normalizeUrl(url).split(/[/?]/)[0].split('.').slice(-2).join('.');
}

// Pages returned by searches or opened by the model. Structured output carries
// no url_citation annotations, so the web_search_call actions are the record.
function consultedUrls(response) {
  return (response.output || [])
    .filter((item) => item.type === 'web_search_call' && item.action)
    .flatMap(({ action }) => [...(action.sources || []).map((source) => source.url), action.url])
    .filter(Boolean);
}

// A single-race site's homepage is the event page, unlike listing pages.
function isEventLink(url) {
  const normalized = normalizeUrl(url);
  return Boolean(normalized) && (/^[^/?]+$/.test(normalized) || !isGenericUrl(url));
}

function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && dayjs(date).format('YYYY-MM-DD') === date;
}

function extractWebSearchEvents(response, { today, windowDays }) {
  if (!response || response.status !== 'completed') return [];

  const outputText = (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .find((content) => content.type === 'output_text');
  if (!outputText) return [];

  let events;
  try {
    ({ events } = JSON.parse(outputText.text));
  } catch {
    return [];
  }

  // Guard against invented events: the event's site must be one the search actually consulted.
  const citedSites = new Set(consultedUrls(response).map(siteOf));
  const end = windowEnd(today, windowDays);

  return (events || [])
    .filter((event) => isValidDate(event.date) && event.date >= today && event.date <= end)
    .filter((event) => isEventLink(event.eventUrl) && citedSites.has(siteOf(event.eventUrl)))
    .map((event) => ({
      name: event.name,
      date: event.date,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      description: event.description || '',
      url: event.eventUrl,
      source: 'websearch',
    }));
}

module.exports = { buildWebSearchRequest, extractWebSearchEvents };
