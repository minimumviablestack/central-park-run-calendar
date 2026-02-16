import dayjs from 'dayjs';

const IDEAL_TEMP_MIN = 40;
const IDEAL_TEMP_MAX = 80;
const MAX_PRECIP_CHANCE = 40;
const MIN_WINDOW_HOURS = 1;

export function findBestRunningWindow(events, hourlyForecast) {
  if (!hourlyForecast || hourlyForecast.length === 0) return null;

  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');

  const eventEndMap = {};
  events.forEach((evt) => {
    if (dayjs(evt.DATE).isSame(today, 'day') && evt.END_TIME) {
      const endTime = dayjs(`${todayStr} ${evt.END_TIME}`, 'YYYY-MM-DD h:mm A');
      if (endTime.isValid()) {
        const hour = endTime.hour();
        eventEndMap[hour] = true;
      }
    }
  });

  const validWindows = [];
  let windowStart = null;

  hourlyForecast.forEach((period, idx) => {
    const time = dayjs(period.startTime);
    if (!time.isSame(today, 'day')) return;

    const hour = time.hour();
    const temp = period.temperature;
    const precipChance = period.probabilityOfPrecipitation?.value || 0;
    const eventActive = eventEndMap[hour];

    const tempOk = temp >= IDEAL_TEMP_MIN && temp <= IDEAL_TEMP_MAX;
    const precipOk = precipChance <= MAX_PRECIP_CHANCE;
    const eventOk = !eventActive;

    if (tempOk && precipOk && eventOk) {
      if (windowStart === null) {
        windowStart = hour;
      }
    } else {
      if (windowStart !== null) {
        const windowEnd = hour;
        const duration = windowEnd - windowStart;
        if (duration >= MIN_WINDOW_HOURS) {
          const startPeriod = hourlyForecast[idx - duration];
          const endPeriod = period;
          validWindows.push({
            start: windowStart,
            end: windowEnd,
            duration,
            startTemp: startPeriod?.temperature,
            endTemp: endPeriod?.temperature,
            precipChance: Math.max(
              ...hourlyForecast
                .slice(idx - duration, idx)
                .map((p) => p.probabilityOfPrecipitation?.value || 0)
            ),
          });
        }
        windowStart = null;
      }
    }
  });

  if (windowStart !== null) {
    const lastHour = hourlyForecast[hourlyForecast.length - 1].startTime;
    const windowEnd = dayjs(lastHour).hour() + 1;
    const duration = windowEnd - windowStart;
    if (duration >= MIN_WINDOW_HOURS) {
      validWindows.push({
        start: windowStart,
        end: windowEnd,
        duration,
      });
    }
  }

  if (validWindows.length === 0) return null;

  validWindows.sort((a, b) => b.duration - a.duration);
  return validWindows[0];
}

export function formatBestWindow(window) {
  if (!window) return null;

  const formatHour = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 || 12;
    return `${display} ${period}`;
  };

  let desc = `${formatHour(window.start)} – ${formatHour(window.end)}`;
  if (window.startTemp && window.endTemp) {
    const avgTemp = Math.round((window.startTemp + window.endTemp) / 2);
    desc += ` (${avgTemp}°F`;
    if (window.precipChance > 10) desc += `, ${window.precipChance}% rain`;
    desc += ')';
  }

  return desc;
}
