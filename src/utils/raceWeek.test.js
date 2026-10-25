import dayjs from 'dayjs';
import { getActiveRaceWeek } from './raceWeek';

test('returns the marathon week link from the Sunday before through the Tuesday after', () => {
  expect(getActiveRaceWeek(dayjs('2026-10-25'))?.name).toBe('TCS New York City Marathon');
  expect(getActiveRaceWeek(dayjs('2026-11-01T18:00'))?.name).toBe('TCS New York City Marathon');
  expect(getActiveRaceWeek(dayjs('2026-11-03T23:00'))?.name).toBe('TCS New York City Marathon');
});

test('returns null outside race week', () => {
  expect(getActiveRaceWeek(dayjs('2026-10-24'))).toBeNull();
  expect(getActiveRaceWeek(dayjs('2026-11-04'))).toBeNull();
});

test('race week link points to that year\'s event list', () => {
  expect(getActiveRaceWeek(dayjs('2026-10-30')).url).toBe('https://www.marathon-weekend.com/nyc/2026');
});
