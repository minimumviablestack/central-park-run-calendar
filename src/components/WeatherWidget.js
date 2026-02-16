import React from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import useSettings from '../hooks/useSettings';
import AQIBadge from './AQIBadge';
import { getSunriseSunset, formatTime } from '../utils/sunCalc';
import { fToC, mphToKph } from '../utils/weatherUtils';

const CENTRAL_PARK_COORDS = { lat: 40.7812, lon: -73.9665 };
const DRESS_MY_RUN_URL = 'https://dressmyrun.com/place/40.80000,-73.97630';

function WeatherWidget({ weather, weatherLoading }) {
  const { units, setUnits } = useSettings();

  const handleUnitChange = (event, newUnits) => {
    setUnits(newUnits);
  };

  const displayTemp = units === 'metric' ? fToC(weather?.temperature) : weather?.temperature;
  const displayWind = units === 'metric' ? mphToKph(weather?.windSpeed) : weather?.windSpeed;

  const sunTimes = getSunriseSunset(CENTRAL_PARK_COORDS.lat, CENTRAL_PARK_COORDS.lon);

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <WbSunnyIcon color="secondary" fontSize="large" />
          <Box>
            {weatherLoading ? (
              <CircularProgress size={20} />
            ) : weather ? (
              <>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h4" fontWeight="300" sx={{ lineHeight: 1 }}>
                    {displayTemp}°
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {weather.shortForecast}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {displayWind} • {weather.windDirection}
                  </Typography>
                  {sunTimes.sunrise && (
                    <Typography variant="body2" color="text.secondary">
                      🌅 {formatTime(sunTimes.sunrise)}
                    </Typography>
                  )}
                  {sunTimes.sunset && (
                    <Typography variant="body2" color="text.secondary">
                      🌇 {formatTime(sunTimes.sunset)}
                    </Typography>
                  )}
                </Stack>
              </>
            ) : (
              <Typography variant="caption">Weather Unavailable</Typography>
            )}
          </Box>
        </Stack>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <AQIBadge />
          <ToggleButtonGroup
            value={units}
            exclusive
            onChange={handleUnitChange}
            size="small"
            sx={{ height: 32 }}
          >
            <ToggleButton value="us" sx={{ px: 1, py: 0, fontSize: '0.75rem' }}>
              °F
            </ToggleButton>
            <ToggleButton value="metric" sx={{ px: 1, py: 0, fontSize: '0.75rem' }}>
              °C
            </ToggleButton>
          </ToggleButtonGroup>

          <Button 
            variant="outlined"
            size="small" 
            startIcon={<CheckroomIcon />}
            href={DRESS_MY_RUN_URL}
            target="_blank"
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            What to wear
          </Button>
          <Button 
            variant="outlined"
            size="small" 
            href={DRESS_MY_RUN_URL}
            target="_blank"
            sx={{ display: { xs: 'flex', sm: 'none' }, minWidth: 0, p: 1 }}
          >
            <CheckroomIcon />
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default WeatherWidget;
