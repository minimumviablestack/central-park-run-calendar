import React from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CheckroomIcon from '@mui/icons-material/Checkroom';

const DRESS_MY_RUN_URL = 'https://dressmyrun.com/place/40.80000,-73.97630';

function WeatherWidget({ weather, weatherLoading }) {
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
                    {weather.temperature}°
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {weather.shortForecast}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {weather.windSpeed} • {weather.windDirection}
                </Typography>
              </>
            ) : (
              <Typography variant="caption">Weather Unavailable</Typography>
            )}
          </Box>
        </Stack>
        
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
    </Paper>
  );
}

export default WeatherWidget;
