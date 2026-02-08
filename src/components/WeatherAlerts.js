import React from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AcUnitIcon from '@mui/icons-material/AcUnit';

function WeatherAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {alerts.map((alert, index) => {
        const isSevere = alert.severity === 'Severe' || alert.severity === 'Extreme';
        const isCold = alert.event.toLowerCase().includes('cold') || alert.event.toLowerCase().includes('freeze');
        
        return (
          <Card 
            key={index}
            elevation={0}
            sx={{
              bgcolor: isSevere ? 'error.light' : 'warning.light',
              color: isSevere ? 'error.dark' : 'warning.dark',
              border: '2px solid',
              borderColor: isSevere ? 'error.main' : 'warning.main',
              borderRadius: 3
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {isCold ? (
                    <AcUnitIcon sx={{ color: isSevere ? 'error.dark' : 'warning.dark' }} />
                  ) : (
                    <WarningAmberIcon sx={{ color: isSevere ? 'error.dark' : 'warning.dark' }} />
                  )}
                  <Typography variant="subtitle1" fontWeight="800">
                    {alert.event}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {alert.headline}
                </Typography>
                {alert.instruction && (
                  <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.8 }}>
                    {alert.instruction.split('\n')[0]}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

export default WeatherAlerts;
