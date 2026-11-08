import dayjs from 'dayjs';

const WEATHER_ICONS = {
  sunny: '☀️',
  'partly cloudy': '⛅',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
  snowy: '🌨️',
  foggy: '🌫️',
  clear: '🌙',
};

// Runner-oriented slices of the day. Overnight (11pm–5am) is left out on
// purpose — nobody is planning a park run off those hours.
export const DAY_PARTS = [
  { id: 'early', label: 'Early', startHour: 5, endHour: 8 },
  { id: 'morning', label: 'Morning', startHour: 8, endHour: 11 },
  { id: 'midday', label: 'Midday', startHour: 11, endHour: 14 },
  { id: 'afternoon', label: 'Afternoon', startHour: 14, endHour: 17 },
  { id: 'evening', label: 'Evening', startHour: 17, endHour: 20 },
  { id: 'night', label: 'Night', startHour: 20, endHour: 23 },
];

export function getWeatherIcon(period) {
  if (!period) return '❓';
  const f = period.shortForecast?.toLowerCase() || '';
  if (f.includes('thunder')) return WEATHER_ICONS.stormy;
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return WEATHER_ICONS.rainy;
  if (f.includes('snow')) return WEATHER_ICONS.snowy;
  if (f.includes('fog')) return WEATHER_ICONS.foggy;
  if ((f.includes('cloudy') || f.includes('sunny')) && (f.includes('partly') || f.includes('mostly sunny'))) {
    return WEATHER_ICONS['partly cloudy'];
  }
  if (f.includes('cloudy') || f.includes('overcast')) return WEATHER_ICONS.cloudy;
  if (f.includes('clear') && period.isDaytime === false) return WEATHER_ICONS.clear;
  if (f.includes('clear') || f.includes('sunny')) return WEATHER_ICONS.sunny;
  return '❓';
}

const precipOf = (period) => period.probabilityOfPrecipitation?.value || 0;

const windOf = (period) => {
  const matches = String(period.windSpeed || '').match(/\d+/g);
  return matches ? Math.max(...matches.map(Number)) : 0;
};

// The period most worth showing an icon for: wettest hour, else the middle one.
const representativePeriod = (periods) => {
  const wettest = periods.reduce((a, b) => (precipOf(b) > precipOf(a) ? b : a));
  return precipOf(wettest) > 0 ? wettest : periods[Math.floor(periods.length / 2)];
};

/**
 * Group NWS hourly periods by local calendar day.
 * @returns {Object} { 'YYYY-MM-DD': { high, low, maxPrecip, icon, periods } }
 */
export function groupForecastByDay(hourlyForecast) {
  if (!hourlyForecast || hourlyForecast.length === 0) return {};
  const map = {};
  hourlyForecast.forEach((period) => {
    if (typeof period.temperature !== 'number') return;
    const key = dayjs(period.startTime).format('YYYY-MM-DD');
    if (!map[key]) map[key] = { periods: [] };
    map[key].periods.push(period);
  });

  Object.values(map).forEach((day) => {
    const temps = day.periods.map((p) => p.temperature);
    const daytime = day.periods.filter((p) => p.isDaytime);
    day.high = Math.max(...temps);
    day.low = Math.min(...temps);
    day.maxPrecip = Math.max(...day.periods.map(precipOf));
    day.icon = getWeatherIcon(representativePeriod(daytime.length ? daytime : day.periods));
  });
  return map;
}

/**
 * Summarize one day's hourly periods into runner-friendly day parts.
 * Parts with no forecast hours (e.g. earlier today) are omitted.
 */
export function summarizeDayParts(periods) {
  if (!periods || periods.length === 0) return [];
  return DAY_PARTS.map((part) => {
    const inPart = periods.filter((p) => {
      const hour = dayjs(p.startTime).hour();
      return hour >= part.startHour && hour < part.endHour;
    });
    if (inPart.length === 0) return null;
    const temps = inPart.map((p) => p.temperature);
    return {
      ...part,
      low: Math.min(...temps),
      high: Math.max(...temps),
      maxPrecip: Math.max(...inPart.map(precipOf)),
      maxWind: Math.max(...inPart.map(windOf)),
      icon: getWeatherIcon(representativePeriod(inPart)),
      shortForecast: representativePeriod(inPart).shortForecast,
    };
  }).filter(Boolean);
}

export function formatHourRange(startHour, endHour) {
  const fmt = (h) => dayjs().hour(h).format('ha');
  return `${fmt(startHour)}–${fmt(endHour)}`;
}
