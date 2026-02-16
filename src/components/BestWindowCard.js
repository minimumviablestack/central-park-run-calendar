import React from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { findBestRunningWindow, formatBestWindow } from '../utils/bestWindow';

function BestWindowCard({ events, hourlyForecast }) {
  const window = findBestRunningWindow(events, hourlyForecast);
  const formatted = formatBestWindow(window);

  if (!formatted) return null;

  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: 'info.light',
        color: 'info.dark',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'info.main',
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ScheduleIcon fontSize="small" />
          <Typography variant="body2" fontWeight="600">
            Best window to run:
          </Typography>
          <Typography variant="body2">
            {formatted}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default BestWindowCard;
