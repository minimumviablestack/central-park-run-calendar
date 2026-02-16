const LOCATION_TO_SEGMENTS = [
  { patterns: ['72nd', 'terrace drive', 'bethesda'], segments: ['transverse_72', 'drive_south', 'drive_east_mid'] },
  { patterns: ['102nd', 'connecting drive'], segments: ['transverse_102', 'drive_north', 'drive_east_mid'] },
  { patterns: ['harlem hill', 'harlem meer', '110th', 'warriors gate', 'north end'], segments: ['drive_north'] },
  { patterns: ['cat hill', 'engineers gate', '90th', 'metropolitan', 'east drive'], segments: ['drive_east_mid'] },
  { patterns: ['great hill', 'west drive', 'summit rock', 'north meadow'], segments: ['drive_west_mid'] },
  { patterns: ['columbus circle', 'tavern on the green', '59th', 'sheep meadow', 'south end'], segments: ['drive_south'] },
  { patterns: ['reservoir', 'jko', 'jacqueline'], segments: ['reservoir'] },
  { patterns: ['bridle path'], segments: ['bridle_path'] },
];

const ALL_DRIVE_SEGMENTS = [
  'drive_south', 'drive_east_mid', 'drive_north', 'drive_west_mid',
  'transverse_72', 'transverse_102',
];

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
