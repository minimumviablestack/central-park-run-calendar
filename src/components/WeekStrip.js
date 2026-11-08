import React, { useMemo, useState } from 'react';
import { Box, Card, CardActionArea, Chip, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import useSettings from '../hooks/useSettings';
import { groupForecastByDay, summarizeDayParts, formatHourRange } from '../utils/dailyForecast';
import { fToC } from '../utils/weatherUtils';

dayjs.extend(isSameOrAfter);

const RAIN_CHIP_THRESHOLD = 30;

function DayDetail({ day, forecast, events, units }) {
  const toUnits = (f) => (units === 'metric' ? fToC(f) : Math.round(f));
  const windLabel = (mph) => (units === 'metric' ? `${Math.round(mph * 1.60934)} km/h` : `${mph} mph`);
  const parts = useMemo(() => summarizeDayParts(forecast?.periods), [forecast]);

  // Shared temperature scale for the range bars, so parts compare visually.
  const scaleMin = Math.min(...parts.map((p) => p.low));
  const scaleMax = Math.max(...parts.map((p) => p.high));
  const span = Math.max(scaleMax - scaleMin, 1);

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
      aria-live="polite"
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" component="h3" fontWeight="bold">
          {day.isSame(dayjs(), 'day') ? 'Today' : day.format('dddd')}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {day.format('MMM D')}
          </Typography>
        </Typography>
        {forecast && (
          <Typography variant="body2" color="text.secondary">
            H {toUnits(forecast.high)}° · L {toUnits(forecast.low)}°
          </Typography>
        )}
      </Stack>

      {parts.length > 0 ? (
        <Stack spacing={1} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {parts.map((part) => (
            <Box
              component="li"
              key={part.id}
              sx={{ display: 'grid', gridTemplateColumns: '78px 26px 64px 1fr', alignItems: 'center', columnGap: 1 }}
              aria-label={`${part.label}, ${formatHourRange(part.startHour, part.endHour)}: ${part.shortForecast}, ${toUnits(part.low)} to ${toUnits(part.high)} degrees, ${part.maxPrecip}% chance of rain, wind up to ${windLabel(part.maxWind)}`}
            >
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{part.label}</Typography>
                <Typography variant="caption" color="text.secondary">{formatHourRange(part.startHour, part.endHour)}</Typography>
              </Box>
              <Typography component="span" title={part.shortForecast} aria-hidden="true">{part.icon}</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                {toUnits(part.low) === toUnits(part.high)
                  ? `${toUnits(part.low)}°`
                  : `${toUnits(part.low)}–${toUnits(part.high)}°`}
              </Typography>
              <Box>
                <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: 'action.hover' }} aria-hidden="true">
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      borderRadius: 3,
                      bgcolor: 'secondary.main',
                      left: `${((part.low - scaleMin) / span) * 100}%`,
                      width: `max(6px, ${((part.high - part.low) / span) * 100}%)`,
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, whiteSpace: 'nowrap' }}>
                  💧 {part.maxPrecip}% · 💨 {windLabel(part.maxWind)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {forecast ? 'No more daytime hours left in the forecast.' : 'Hourly forecast not available yet for this day.'}
        </Typography>
      )}

      {events.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight={700} color="warning.dark">
            {events.length === 1 ? '1 event in the park' : `${events.length} events in the park`}
          </Typography>
          {events.map((evt, idx) => (
            <Typography key={idx} variant="body2">
              <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                {evt.START_TIME}{evt.END_TIME ? `–${evt.END_TIME}` : ''}
              </Box>
              {evt.EVENT_NAME}
            </Typography>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function WeekStrip({ events, hourlyForecast }) {
  const { units } = useSettings();
  const todayKey = dayjs().format('YYYY-MM-DD');
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const days = useMemo(() => {
    const today = dayjs(todayKey);
    return Array.from({ length: 7 }, (_, i) => today.add(i, 'day'));
  }, [todayKey]);

  const eventDays = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      const date = dayjs(evt.DATE);
      if (date.isSameOrAfter(todayKey, 'day')) {
        const key = date.format('YYYY-MM-DD');
        if (!map[key]) map[key] = [];
        map[key].push(evt);
      }
    });
    return map;
  }, [events, todayKey]);

  const dailyForecast = useMemo(() => groupForecastByDay(hourlyForecast), [hourlyForecast]);

  const toUnits = (f) => (units === 'metric' ? fToC(f) : Math.round(f));
  const selectedDay = days.find((d) => d.format('YYYY-MM-DD') === selectedKey) || days[0];

  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: 'auto', pb: 1, mx: -2, px: 2 }}>
        <Stack direction="row" spacing={1} role="group" aria-label="7-day forecast" sx={{ width: 'max-content', minWidth: '100%' }}>
          {days.map((day) => {
            const dayStr = day.format('YYYY-MM-DD');
            const isToday = dayStr === todayKey;
            const isSelected = dayStr === selectedDay.format('YYYY-MM-DD');
            const dayEvents = eventDays[dayStr] || [];
            const forecast = dailyForecast[dayStr];

            const label = [
              isToday ? 'Today' : day.format('dddd'),
              day.format('MMMM D'),
              forecast ? `high ${toUnits(forecast.high)}°, low ${toUnits(forecast.low)}°` : 'no forecast yet',
              dayEvents.length > 0 ? `${dayEvents.length} park event${dayEvents.length > 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(', ');

            return (
              <Card
                key={dayStr}
                elevation={0}
                sx={{
                  flex: '1 0 76px',
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isToday ? 'primary.light' : 'background.paper',
                  textAlign: 'center',
                  transition: 'border-color 0.2s',
                }}
              >
                <CardActionArea
                  onClick={() => setSelectedKey(dayStr)}
                  aria-pressed={isSelected}
                  aria-label={label}
                  sx={{ p: 1.25, height: '100%' }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={isToday ? 700 : 500}
                    color={isToday ? 'primary.dark' : 'text.secondary'}
                    display="block"
                  >
                    {isToday ? 'Today' : day.format('ddd')}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color={isToday ? 'primary.dark' : 'text.primary'}>
                    {day.format('D')}
                  </Typography>
                  <Typography variant="h6" component="span" sx={{ my: 0.25, display: 'block' }} aria-hidden="true">
                    {forecast?.icon || '–'}
                  </Typography>
                  {forecast ? (
                    <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" fontWeight={700}>{toUnits(forecast.high)}°</Box>
                      <Box component="span" color="text.secondary"> {toUnits(forecast.low)}°</Box>
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                  <Box sx={{ height: 18, mt: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    {forecast && forecast.maxPrecip >= RAIN_CHIP_THRESHOLD && (
                      <Chip
                        label={`${forecast.maxPrecip}%`}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                      />
                    )}
                    {dayEvents.length > 0 && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                    )}
                  </Box>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      </Box>

      <DayDetail
        day={selectedDay}
        forecast={dailyForecast[selectedDay.format('YYYY-MM-DD')]}
        events={eventDays[selectedDay.format('YYYY-MM-DD')] || []}
        units={units}
      />
    </Stack>
  );
}

export default WeekStrip;
