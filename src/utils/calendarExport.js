import dayjs from 'dayjs';

export function generateICS(event) {
  const startDate = dayjs(event.DATE);
  const startTime = event.START_TIME
    ? dayjs(`${event.DATE} ${event.START_TIME}`, 'YYYY-MM-DD h:mm A')
    : startDate.hour(9).minute(0);
  
  const endTime = event.END_TIME
    ? dayjs(`${event.DATE} ${event.END_TIME}`, 'YYYY-MM-DD h:mm A')
    : startTime.add(3, 'hour');

  const formatICSDate = (d) => d.utc().format('YYYYMMDD[T]HHmmss[Z]');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Central Park Run//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@centralpark.run`,
    `DTSTAMP:${formatICSDate(dayjs())}`,
    `DTSTART:${formatICSDate(startTime)}`,
    `DTEND:${formatICSDate(endTime)}`,
    `SUMMARY:${event.EVENT_NAME}`,
    `LOCATION:${event.LOCATION || 'Central Park'}`,
    event.DESCRIPTION ? `DESCRIPTION:${event.DESCRIPTION}` : null,
    event.URL ? `URL:${event.URL}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return ics;
}

export function downloadICS(event) {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.EVENT_NAME.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(event) {
  const startDate = dayjs(event.DATE);
  const startTime = event.START_TIME
    ? dayjs(`${event.DATE} ${event.START_TIME}`, 'YYYY-MM-DD h:mm A')
    : startDate.hour(9).minute(0);
  
  const endTime = event.END_TIME
    ? dayjs(`${event.DATE} ${event.END_TIME}`, 'YYYY-MM-DD h:mm A')
    : startTime.add(3, 'hour');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.EVENT_NAME,
    dates: `${startTime.utc().format('YYYYMMDDTHHmmss[Z]')}/${endTime.utc().format('YYYYMMDDTHHmmss[Z]')}`,
    location: event.LOCATION || 'Central Park',
    details: event.URL || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
