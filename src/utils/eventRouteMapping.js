import locationSegments from '../data/locationSegments.json';

const LOCATION_TO_SEGMENTS = locationSegments.mappings;
const ALL_DRIVE_SEGMENTS = locationSegments.allDriveSegments;

export const mapEventToSegments = (event) => {
  const location = (event.LOCATION || '').toLowerCase();

  if (!location || location === 'central park' || location === 'central park, new york') {
    return ALL_DRIVE_SEGMENTS;
  }

  const matched = new Set();
  for (const mapping of LOCATION_TO_SEGMENTS) {
    for (const pattern of mapping.patterns) {
      if (location.includes(pattern)) {
        mapping.segments.forEach(s => matched.add(s));
      }
    }
  }

  return matched.size > 0 ? Array.from(matched) : ALL_DRIVE_SEGMENTS;
};

export const getAffectedSegments = (todayEvents) => {
  const affected = new Set();
  for (const event of todayEvents) {
    mapEventToSegments(event).forEach(s => affected.add(s));
  }
  return Array.from(affected);
};
