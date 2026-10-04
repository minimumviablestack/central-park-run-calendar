import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const NYC_TZ = 'America/New_York';

// The crawler's upstream sources are inconsistent about time formatting
// ("8:00 AM", "9:15 a.m.", "08:00" all show up in data/events.csv), so try
// a few formats rather than assuming one. Falls back to fallbackHour on
// anything unparseable instead of producing an Invalid Date.
const TIME_FORMATS = ['YYYY-MM-DD h:mm A', 'YYYY-MM-DD HH:mm'];

// dayjs's timezone plugin computes the UTC offset via Intl.DateTimeFormat as
// part of constructing/formatting the result, which throws synchronously
// (RangeError: Invalid time value) rather than yielding an invalid-but-safe
// object when the input didn't actually match the given format. isValid()
// can't be trusted to guard that — every attempt has to be its own try/catch.
function tryFormat(dateTimeStr, format) {
  try {
    const parsed = dayjs.tz(dateTimeStr, format, NYC_TZ);
    return parsed.isValid() ? parsed.format() : null;
  } catch {
    return null;
  }
}

function toISODateTime(dateStr, timeStr, fallbackHour) {
  if (timeStr) {
    const normalized = timeStr.trim().replace(/\./g, '').toUpperCase();
    for (const format of TIME_FORMATS) {
      const result = tryFormat(`${dateStr} ${normalized}`, format);
      if (result) return result;
    }
  }
  try {
    const fallback = dayjs.tz(dateStr, 'YYYY-MM-DD', NYC_TZ);
    if (!fallback.isValid()) return null;
    return fallback.hour(fallbackHour).minute(0).format();
  } catch {
    return null;
  }
}

export function buildEventsStructuredData(events) {
  if (!events || events.length === 0) return null;

  const eventNodes = events
    .filter((event) => event.EVENT_NAME && event.DATE)
    .map((event) => {
      const startDate = toISODateTime(event.DATE, event.START_TIME, 9);
      if (!startDate) return null;

      const node = {
        '@type': 'SportsEvent',
        name: event.EVENT_NAME,
        startDate,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: event.LOCATION || 'Central Park',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'New York',
            addressRegion: 'NY',
            addressCountry: 'US',
          },
        },
      };
      if (event.END_TIME) {
        const endDate = toISODateTime(event.DATE, event.END_TIME, 12);
        if (endDate) node.endDate = endDate;
      }
      if (event.DESCRIPTION) node.description = event.DESCRIPTION;
      if (event.URL) node.url = event.URL;
      return node;
    })
    .filter(Boolean);

  if (eventNodes.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@graph': eventNodes,
  };
}

const SCRIPT_ID = 'event-structured-data';

export function injectEventsStructuredData(events) {
  const data = buildEventsStructuredData(events);
  const existing = document.getElementById(SCRIPT_ID);

  if (!data) {
    if (existing) existing.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = SCRIPT_ID;
  script.type = 'application/ld+json';
  script.text = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}
