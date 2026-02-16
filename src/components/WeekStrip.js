import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrAfter);

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

function getWeatherIcon(forecast) {
  if (!forecast) return '❓';
  const f = forecast.shortForecast?.toLowerCase() || '';
  if (f.includes('thunder')) return WEATHER_ICONS.stormy;
  if (f.includes('rain')) return WEATHER_ICONS.rainy;
  if (f.includes('snow')) return WEATHER_ICONS.snowy;
  if (f.includes('fog')) return WEATHER_ICONS.foggy;
  if (f.includes('cloudy') && f.includes('partly')) return WEATHER_ICONS['partly cloudy'];
  if (f.includes('cloudy') || f.includes('overcast')) return WEATHER_ICONS.cloudy;
  if (f.includes('clear') && f.includes('night')) return WEATHER_ICONS.clear;
  if (f.includes('clear') || f.includes('sunny')) return WEATHER_ICONS.sunny;
  return '❓';
}

function WeekStrip({ events, hourlyForecast }) {
  const today = dayjs();
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => today.add(i, 'day'));
  }, [today]);

  const eventDays = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      const date = dayjs(evt.DATE);
      if (date.isSameOrAfter(today, 'day')) {
        const key = date.format('YYYY-MM-DD');
        if (!map[key]) map[key] = [];
        map[key].push(evt);
      }
    });
    return map;
  }, [events, today]);

  const dailyForecast = useMemo(() => {
    if (!hourlyForecast || hourlyForecast.length === 0) return {};
    const map = {};
    hourlyForecast.forEach((period) => {
      const time = dayjs(period.startTime);
      const key = time.format('YYYY-MM-DD');
      if (!map[key]) {
        map[key] = { high: -100, low: 100, periods: [] };
      }
      const temp = period.temperature;
      if (temp > map[key].high) map[key].high = temp;
      if (temp < map[key].low) map[key].low = temp;
      map[key].periods.push(period);
    });
    return map;
  }, [hourlyForecast]);

  return (
    <Box sx={{ overflowX: 'auto', pb: 1, mx: -2, px: 2 }}>
      <Grid container spacing={1} sx={{ minWidth: 500, width: 'max-content' }}>
        {days.map((day) => {
          const dayStr = day.format('YYYY-MM-DD');
          const isToday = day.isSame(today, 'day');
          const dayEvents = eventDays[dayStr] || [];
          const forecast = dailyForecast[dayStr];
          const icon = getWeatherIcon(forecast?.periods?.[0]);

          return (
            <Grid item xs key={dayStr}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: isToday ? 'primary.main' : 'divider',
                  bgcolor: isToday ? 'primary.light' : 'background.paper',
                  minWidth: 90,
                  textAlign: 'center',
                  cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  '&:hover': dayEvents.length > 0 ? {
                    transform: 'scale(1.02)',
                    borderColor: 'primary.light',
                  } : {},
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography
                    variant="caption"
                    fontWeight={isToday ? 700 : 500}
                    color={isToday ? 'primary.dark' : 'text.secondary'}
                    display="block"
                  >
                    {day.format('ddd')}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={isToday ? 'primary.dark' : 'text.primary'}
                  >
                    {day.format('D')}
                  </Typography>
                  <Typography variant="h6" sx={{ my: 0.5 }}>
                    {icon}
                  </Typography>
                  {forecast && (
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(forecast.high)}°
                    </Typography>
                  )}
                  {dayEvents.length > 0 && (
                    <Box
                      sx={{
                        mt: 0.5,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'warning.main',
                        mx: 'auto',
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default WeekStrip;
