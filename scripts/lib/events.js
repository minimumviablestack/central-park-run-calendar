const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref)$/i;

// Listing pages shared by many events — a match on one of these says nothing
// about whether two rows are the same event.
const GENERIC_HOSTS = new Set(['data.cityofnewyork.us']);
const GENERIC_LAST_SEGMENT = /((^|-)(events|races|calendar)|^fullraceyearindex)$/i;

const NAME_STOPWORDS = new Set([
  'nyrr', 'nycruns', 'nyc', 'new', 'york', 'city', 'the', 'to', 'of', 'and',
  'presented', 'by', 'annual', 'central', 'park',
]);
const NAME_SYNONYMS = { tri: 'triathlon' };
const NAME_SIMILARITY_THRESHOLD = 0.6;

function normalizeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname.replace(/\/+$/, '');
  const params = [...parsed.searchParams].filter(([key]) => !TRACKING_PARAM.test(key));
  const query = params.length ? `?${new URLSearchParams(params)}` : '';
  return `${host}${pathname}${query}`;
}

function isGenericUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return true;

  const [host, ...segments] = normalized.split('?')[0].split('/');
  if (GENERIC_HOSTS.has(host) || segments.length === 0) return true;
  return GENERIC_LAST_SEGMENT.test(segments[segments.length - 1]);
}

function nameTokens(name) {
  return new Set(
    (name || '')
      .toLowerCase()
      .replace(/'/g, '')
      .split(/[^a-z0-9.]+/)
      .map((token) => token.replace(/^\.+|\.+$/g, ''))
      .filter((token) => token && !NAME_STOPWORDS.has(token) && !/^(19|20)\d\d$/.test(token))
      .map((token) => NAME_SYNONYMS[token] || token)
  );
}

function numericTokens(tokens) {
  return [...tokens].filter((token) => /\d/.test(token)).sort().join(',');
}

// "Rising NYRR at X" / "Girls Run at X" are side events held alongside X.
function isSideEvent(name) {
  return /\bat\b/i.test(name || '');
}

function namesMatch(a, b) {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  if (isSideEvent(a) !== isSideEvent(b)) return false;

  // Different distances or stage numbers mean different races.
  const numbersA = numericTokens(tokensA);
  const numbersB = numericTokens(tokensB);
  if (numbersA && numbersB && numbersA !== numbersB) return false;

  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = tokensA.size + tokensB.size - shared;
  return shared / union >= NAME_SIMILARITY_THRESHOLD;
}

function isSameEvent(a, b) {
  if (a.date !== b.date) return false;

  const bothSpecific = !isGenericUrl(a.url) && !isGenericUrl(b.url);
  if (bothSpecific) {
    const urlA = normalizeUrl(a.url);
    const urlB = normalizeUrl(b.url);
    if (urlA === urlB) return true;
    // One organizer gives each of its events its own page.
    if (urlA.split('/')[0] === urlB.split('/')[0]) return false;
  }
  return namesMatch(a.name, b.name);
}

// Prefer a row that links to the event itself, then the more detailed one.
function isBetterEntry(candidate, current) {
  const candidateSpecific = !isGenericUrl(candidate.url);
  const currentSpecific = !isGenericUrl(current.url);
  if (candidateSpecific !== currentSpecific) return candidateSpecific;
  return (candidate.description || '').length > (current.description || '').length;
}

function deduplicateEvents(events) {
  const groups = [];

  events.forEach((event) => {
    const group = groups.find((members) => members.some((member) => isSameEvent(member, event)));
    if (group) {
      group.push(event);
    } else {
      groups.push([event]);
    }
  });

  return groups.map((members) => members.reduce((best, event) => (isBetterEntry(event, best) ? event : best)));
}

// NYC Parks lists a big race's permit as one all-day row per day of stage
// setup and teardown (the marathon's runs ~3 weeks). The park stays runnable
// on those days, so only the race day itself is worth showing.
const PERMIT_SOURCE = 'nyc-open-data';
const PERMIT_WINDOW_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

function isAllDayPermit(event) {
  return event.source === PERMIT_SOURCE
    && /^12:00\s*AM$/i.test((event.startTime || '').trim())
    && /^11:59\s*PM$/i.test((event.endTime || '').trim());
}

function daysApart(a, b) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;
}

function dropPermitSetupDays(events) {
  const races = events.filter((event) => event.source !== PERMIT_SOURCE);
  return events.filter((event) => {
    if (!isAllDayPermit(event)) return true;
    const nearbyRaces = races.filter((race) => namesMatch(race.name, event.name)
      && daysApart(race.date, event.date) <= PERMIT_WINDOW_DAYS);
    return nearbyRaces.length === 0 || nearbyRaces.some((race) => race.date === event.date);
  });
}

module.exports = { normalizeUrl, isGenericUrl, namesMatch, deduplicateEvents, dropPermitSetupDays };
