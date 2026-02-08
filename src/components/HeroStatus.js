import React from 'react';
import { Box, Button, Card, CardContent, Chip, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { parseWeatherData } from '../hooks/useWeather';

function HeroStatus({ todayEvents, weather }) {
  if (todayEvents.length > 0) {
    return (
      <Card 
        elevation={0}
        sx={{
          bgcolor: 'warning.light', 
          color: 'warning.dark',
          border: '1px solid',
          borderColor: 'warning.main',
          borderRadius: 4
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Chip 
                 label="EVENT TODAY" 
                 sx={{ 
                   bgcolor: 'warning.main', 
                   color: 'white', 
                   fontWeight: 'bold' 
                 }} 
                 size="small" 
               />
            </Box>
            <Typography variant="h4" fontWeight="800" sx={{ lineHeight: 1 }}>
              Watch out for crowds.
            </Typography>
            
            <Stack spacing={2} sx={{ mt: 1 }}>
              {todayEvents.map((event, index) => (
                <Paper key={index} elevation={0} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 2 }}>
                   <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="text.primary">
                     {event.EVENT_NAME}
                   </Typography>
                   <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                     <Typography variant="body2" fontWeight="500" color="text.secondary">
                       {event.START_TIME}{event.END_TIME ? ` - ${event.END_TIME}` : ''}
                     </Typography>
                     {event.LOCATION && (
                       <Typography variant="body2" fontWeight="500" color="text.secondary">
                         {event.LOCATION}
                       </Typography>
                     )}
                   </Stack>
                   <Button 
                     variant="outlined" 
                     color="warning" 
                     size="small" 
                     href={event.URL} 
                     target="_blank"
                     endIcon={<ArrowForwardIcon />}
                     fullWidth
                   >
                     Event Details
                   </Button>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const forecast = parseWeatherData(weather);
  const isBad = weather && (weather.temperature < 30 || weather.temperature > 90 || forecast.precipChance > 80 || forecast.hasThunderstorm);
  const isGreat = weather && !isBad && forecast.precipChance < 20 && weather.temperature > 50 && weather.temperature < 75;
  
  return (
    <Card 
      elevation={0}
      sx={{
        bgcolor: isBad ? 'warning.light' : 'success.light', 
        color: isBad ? 'warning.dark' : 'success.dark',
        border: '1px solid',
        borderColor: isBad ? 'warning.main' : 'success.main',
        borderRadius: 4
      }}
    >
       <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
         {weather ? (
           <>
             <Typography variant="h3" fontWeight="900" sx={{ mb: 0.5, letterSpacing: '-1px' }}>
               {isBad ? 'MAYBE' : 'YES!'}
             </Typography>
             <Typography variant="subtitle1" fontWeight="500" sx={{ opacity: 0.9, lineHeight: 1.2 }}>
               {isBad ? 'Conditions are not ideal.' : isGreat ? 'It\'s a perfect day for a run!' : 'The park is open for you.'}
             </Typography>
           </>
         ) : (
           <Typography variant="h6">Loading...</Typography>
         )}
       </CardContent>
    </Card>
  );
}

export default HeroStatus;
