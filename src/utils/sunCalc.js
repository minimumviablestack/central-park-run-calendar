const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

function calcSunriseOrSunset(lat, lon, date, isSunrise) {
  const dayOfYear = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );

  const lngHour = lon / 15;
  const t = isSunrise
    ? dayOfYear + (6 - lngHour) / 24
    : dayOfYear + (18 - lngHour) / 24;

  const m = (0.9856 * t) - 3.289;

  let l = m + (1.916 * Math.sin(m * DEGREES_TO_RADIANS)) + 
          (0.020 * Math.sin(2 * m * DEGREES_TO_RADIANS)) + 282.634;
  l = l % 360;
  if (l < 0) l += 360;

  let ra = RADIANS_TO_DEGREES * Math.atan(0.91764 * Math.tan(l * DEGREES_TO_RADIANS));
  let lQuadrant = Math.floor(l / 90) * 90;
  let raQuadrant = Math.floor(ra / 90) * 90;
  ra = ra + (lQuadrant - raQuadrant);
  const raHours = ra / 15;

  const sinDec = 0.39782 * Math.sin(l * DEGREES_TO_RADIANS);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH =
    (Math.sin(-0.01449) - sinDec * Math.sin(lat * DEGREES_TO_RADIANS)) /
    (cosDec * Math.cos(lat * DEGREES_TO_RADIANS));

  if (cosH > 1) return null;
  if (cosH < -1) return null;

  const h = isSunrise
    ? 360 - RADIANS_TO_DEGREES * Math.acos(cosH)
    : RADIANS_TO_DEGREES * Math.acos(cosH);
  const hHours = h / 15;

  const localT = hHours + raHours - (0.06571 * t) - 6.622;
  let ut = localT - lngHour;
  if (ut < 0) ut += 24;
  ut = ut % 24;

  const hours = Math.floor(ut);
  const minutes = Math.floor((ut - hours) * 60);

  return { hours, minutes };
}

export function getSunriseSunset(lat, lon, date = new Date()) {
  const sunrise = calcSunriseOrSunset(lat, lon, date, true);
  const sunset = calcSunriseOrSunset(lat, lon, date, false);

  return {
    sunrise: sunrise
      ? { hours: sunrise.hours, minutes: sunrise.minutes }
      : null,
    sunset: sunset
      ? { hours: sunset.hours, minutes: sunset.minutes }
      : null,
  };
}

export function formatTime(timeObj) {
  if (!timeObj) return '--:--';
  const { hours, minutes } = timeObj;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

export function getGoldenHour(sunrise, sunset) {
  if (!sunrise || !sunset) return null;
  const sunriseMins = sunrise.hours * 60 + sunrise.minutes;
  const sunsetMins = sunset.hours * 60 + sunset.minutes;
  return {
    morningStart: sunriseMins,
    morningEnd: sunriseMins + 60,
    eveningStart: sunsetMins - 60,
    eveningEnd: sunsetMins,
  };
}
