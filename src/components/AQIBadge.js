import React from 'react';
import { Chip, CircularProgress, Stack, Typography } from '@mui/material';
import AirIcon from '@mui/icons-material/Air';
import { useAirQuality } from '../hooks/useAirQuality';

function AQIBadge() {
  const { aqi, loading, category } = useAirQuality();

  if (loading) {
    return (
      <CircularProgress size={20} thickness={4} />
    );
  }

  if (aqi === null || !category) {
    return (
      <Typography variant="caption" color="text.secondary">
        AQI N/A
      </Typography>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <AirIcon sx={{ fontSize: 16, color: category.color }} />
      <Chip
        label={`${aqi} ${category.label}`}
        size="small"
        sx={{
          bgcolor: category.color,
          color: aqi > 100 ? 'white' : 'black',
          fontWeight: 600,
          fontSize: '0.7rem',
          height: 22,
        }}
      />
    </Stack>
  );
}

export default AQIBadge;
