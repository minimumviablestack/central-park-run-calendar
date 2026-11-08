import dayjs from 'dayjs';
import { groupForecastByDay, summarizeDayParts, getWeatherIcon } from './dailyForecast';

const hour = (date, h, temperature, extra = {}) => ({
  startTime: dayjs(`${date}T00:00:00`).hour(h).format(),
  temperature,
  isDaytime: h >= 6 && h < 18,
  shortForecast: 'Sunny',
  windSpeed: '5 mph',
  probabilityOfPrecipitation: { value: 0 },
  ...extra,
});

describe('groupForecastByDay', () => {
  test('returns empty object for missing forecast', () => {
    expect(groupForecastByDay([])).toEqual({});
    expect(groupForecastByDay(undefined)).toEqual({});
  });

  test('computes high, low and max precip per day', () => {
    const forecast = [
      hour('2026-11-07', 6, 41),
      hour('2026-11-07', 14, 58, { probabilityOfPrecipitation: { value: 40 }, shortForecast: 'Chance Rain Showers' }),
      hour('2026-11-07', 22, 45),
      hour('2026-11-08', 9, 50),
    ];
    const days = groupForecastByDay(forecast);
    expect(days['2026-11-07']).toMatchObject({ high: 58, low: 41, maxPrecip: 40, icon: '🌧️' });
    expect(days['2026-11-08']).toMatchObject({ high: 50, low: 50, maxPrecip: 0, icon: '☀️' });
  });
});

describe('summarizeDayParts', () => {
  test('buckets hours into day parts with temperature range, rain and wind', () => {
    const periods = [
      hour('2026-11-07', 5, 40),
      hour('2026-11-07', 6, 42),
      hour('2026-11-07', 7, 44, { windSpeed: '10 to 15 mph' }),
      hour('2026-11-07', 15, 60, { probabilityOfPrecipitation: { value: 25 } }),
      hour('2026-11-07', 2, 35), // overnight, excluded
    ];
    const parts = summarizeDayParts(periods);
    expect(parts.map((p) => p.id)).toEqual(['early', 'afternoon']);
    expect(parts[0]).toMatchObject({ low: 40, high: 44, maxWind: 15, maxPrecip: 0 });
    expect(parts[1]).toMatchObject({ low: 60, high: 60, maxPrecip: 25 });
  });

  test('returns empty list for no periods', () => {
    expect(summarizeDayParts([])).toEqual([]);
  });
});

describe('getWeatherIcon', () => {
  test('uses moon only for clear nighttime periods', () => {
    expect(getWeatherIcon({ shortForecast: 'Clear', isDaytime: false })).toBe('🌙');
    expect(getWeatherIcon({ shortForecast: 'Clear', isDaytime: true })).toBe('☀️');
    expect(getWeatherIcon({ shortForecast: 'Mostly Sunny' })).toBe('⛅');
  });
});
