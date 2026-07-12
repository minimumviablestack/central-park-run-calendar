const locationSegments = require('../../src/data/locationSegments.json');

const RUNNING_KEYWORDS = [
  'run', 'race', 'marathon', 'triathlon', 'duathlon',
  '5k', '10k', 'half', 'relay', 'miler'
];
const DRIVE_EVENT_KEYWORDS = [
  'bike', 'cycling', 'parade', 'march', 'walkathon', 'walk-a-thon', 'charity walk'
];
const LARGE_GATHERING_KEYWORDS = ['concert', 'festival', 'rally'];
const EXCLUDE_KEYWORDS = [
  'museum', 'playground', 'birding', 'bird walk', 'birdwalk',
  'storytime', 'story time', 'lawn closure', 'nature walk', 'gallery'
];

const segmentPatterns = locationSegments.mappings.flatMap((m) => m.patterns);

function isRouteImpacting(event) {
  const name = (event.name || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const loc = (event.location || '').toLowerCase();
  const text = `${name} ${desc}`;

  if (EXCLUDE_KEYWORDS.some((kw) => text.includes(kw))) return false;

  if (RUNNING_KEYWORDS.some((kw) => text.includes(kw))) return true;

  // Non-running events confined to lawns/playgrounds never block the loop
  if (loc.includes('lawn') || loc.includes('playground')) return false;

  const onSegment = segmentPatterns.some((p) => loc.includes(p));
  const genericPark = loc === '' || loc.includes('central park');

  const isDriveEvent = DRIVE_EVENT_KEYWORDS.some((kw) => text.includes(kw));
  const isFilmShoot = text.includes('shooting permit') || text.includes('film shoot');
  if (isDriveEvent || isFilmShoot) return onSegment || genericPark;

  // Concerts/festivals only count when they explicitly sit on a drive
  if (LARGE_GATHERING_KEYWORDS.some((kw) => text.includes(kw))) return onSegment;

  return false;
}

module.exports = { isRouteImpacting };
