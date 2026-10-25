import dayjs from 'dayjs';

// Big races whose week brings shakeout runs and crowds to the park. Add next
// year's date once NYRR announces it.
const RACE_WEEKS = [
  {
    name: 'TCS New York City Marathon',
    raceDate: '2026-11-01',
    url: 'https://www.marathon-weekend.com/nyc/2026',
    note: 'Expect group shakeout runs around Bethesda Terrace and the Obelisk, busiest Saturday morning.',
  },
];

// Sunday before the race through the Tuesday after (Medal Monday/Tuesday runs).
const DAYS_BEFORE = 7;
const DAYS_AFTER = 2;

export function getActiveRaceWeek(today = dayjs()) {
  const day = today.startOf('day');
  return RACE_WEEKS.find(({ raceDate }) => {
    const race = dayjs(raceDate);
    return !day.isBefore(race.subtract(DAYS_BEFORE, 'day')) && !day.isAfter(race.add(DAYS_AFTER, 'day'));
  }) || null;
}
