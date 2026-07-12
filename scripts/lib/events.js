function normalizeEventKey(event) {
  const name = (event.name || '')
    .toLowerCase()
    .replace(/\b(nyrr|nycruns|nyc|new york)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `${name}_${event.date}`;
}

function deduplicateEvents(events) {
  const unique = new Map();

  events.forEach((event) => {
    const key = normalizeEventKey(event);
    const existing = unique.get(key);
    if (!existing || (existing.description || '').length < (event.description || '').length) {
      unique.set(key, event);
    }
  });

  return Array.from(unique.values());
}

module.exports = { normalizeEventKey, deduplicateEvents };
