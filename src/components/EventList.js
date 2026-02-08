import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box,
  Card,
  CardContent,
  Grid,
  Paper, 
  Typography,
  CircularProgress,
  Alert,
  Container,
  Chip,
  Stack,
  Button
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// Extend dayjs with the isSameOrAfter plugin
dayjs.extend(isSameOrAfter);

  const parseWeatherData = (weather) => {
    if (!weather) return { precipChance: 0, hasThunderstorm: false, rainfall: 0, windGust: 0 };
    
    // For hourly forecasts, data is structured differently
    const precipChance = weather.probabilityOfPrecipitation?.value || 0;
    const shortForecast = weather.shortForecast || '';
    const detailedForecast = weather.detailedForecast || '';
    
    // Check for thunderstorms in either forecast field
    const hasThunderstorm = shortForecast.toLowerCase().includes('thunderstorm') || 
                           detailedForecast.toLowerCase().includes('thunderstorm');
    
    // For hourly data, we primarily rely on precipChance, shortForecast for conditions
    // Wind gusts and rainfall amounts may not be available in hourly format
    const gustMatch = detailedForecast.match(/gusts as high as (\d+) mph/);
    const rainfallMatch = detailedForecast.match(/rainfall amounts between \d+ and (\d+) inches/);
    
    return {
      precipChance,
      hasThunderstorm,
      rainfall: rainfallMatch ? parseInt(rainfallMatch[1]) : 0,
      windGust: gustMatch ? parseInt(gustMatch[1]) : 0
    };
  };

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/events.csv'); // Updated path
        if (!response.ok) {
          throw new Error('Failed to fetch events data');
        }
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            // Filter out empty rows and sort events by date
            const filteredData = results.data.filter(row => 
              row.DATE && row.EVENT_NAME && Object.keys(row).length > 0
            );
            
            const sortedEvents = filteredData.sort((a, b) => 
              new Date(a.DATE) - new Date(b.DATE)
            );
            setEvents(sortedEvents);
            setLoading(false);
          },
          error: (error) => {
            setError(error.message);
            setLoading(false);
          }
        });
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Add weather fetch effect
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const pointResponse = await fetch(
          'https://api.weather.gov/points/40.7812,-73.9665'
        );
        const pointData = await pointResponse.json();
        
        const forecastResponse = await fetch(pointData.properties.forecastHourly);
        const forecastData = await forecastResponse.json();
        
        // Find the next hour's forecast
        const now = new Date();
        const nextHour = now.getHours() + 1;
        const nextHourForecast = forecastData.properties.periods.find(period => {
          const periodStart = new Date(period.startTime);
          return periodStart.getHours() >= nextHour && periodStart.getDate() === now.getDate();
        }) || forecastData.properties.periods[1] || forecastData.properties.periods[0]; // fallback to next or first period
        
        setWeather(nextHourForecast);
        setWeatherLoading(false);
      } catch (err) {
        console.error('Weather fetch error:', err);
        setWeatherLoading(false);
      }
    };

    const fetchAlerts = async () => {
      try {
        const response = await fetch(
          'https://api.weather.gov/alerts/active?point=40.7812,-73.9665'
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const activeAlerts = data.features.map(feature => ({
            event: feature.properties.event,
            severity: feature.properties.severity,
            headline: feature.properties.headline,
            description: feature.properties.description,
            instruction: feature.properties.instruction,
            expires: feature.properties.expires
          }));
          setAlerts(activeAlerts);
        }
      } catch (err) {
        console.error('Alerts fetch error:', err);
      }
    };

    fetchWeather();
    fetchAlerts();
  }, []);

  // Removed useEffect for camera refresh

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          Checking the park...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  const today = dayjs();
  
  // Filter to only show current and future events
  const upcomingEvents = events.filter(event => 
    dayjs(event.DATE).isSameOrAfter(today, 'day')
  );
  
  // Separate today's events
  const todayEvents = upcomingEvents.filter(event => 
    dayjs(event.DATE).isSame(today, 'day')
  );
  
  // Future events (not today)
  const futureEvents = upcomingEvents.filter(event => 
    !dayjs(event.DATE).isSame(today, 'day')
  );

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 0.5 }}>
          <DirectionsRunIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" component="h1" fontWeight="800" color="primary.main" sx={{ letterSpacing: '-0.5px' }}>
            Park Run Calendar
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" fontWeight="normal">
          Should I run in Central Park today?
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Weather Alerts */}
        {alerts.length > 0 && (
          <Grid item xs={12}>
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
                            💡 {alert.instruction.split('\n')[0]}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Grid>
        )}

        {/* HERO SECTION: Today's Status */}
        <Grid item xs={12}>
          {todayEvents.length > 0 ? (
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
                             ⏰ {event.START_TIME}{event.END_TIME ? ` - ${event.END_TIME}` : ''}
                           </Typography>
                           {event.LOCATION && (
                             <Typography variant="body2" fontWeight="500" color="text.secondary">
                               📍 {event.LOCATION}
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
          ) : (
            <Card 
              elevation={0}
              sx={{
                bgcolor: weather && (() => {
                  const forecast = parseWeatherData(weather);
                  const isBad = weather.temperature < 30 || weather.temperature > 90 || forecast.precipChance > 80 || forecast.hasThunderstorm;
                  return isBad ? 'warning.light' : 'success.light';
                })(), 
                color: weather && (() => {
                  const forecast = parseWeatherData(weather);
                  const isBad = weather.temperature < 30 || weather.temperature > 90 || forecast.precipChance > 80 || forecast.hasThunderstorm;
                  return isBad ? 'warning.dark' : 'success.dark';
                })(),
                border: '1px solid',
                borderColor: weather && (() => {
                   const forecast = parseWeatherData(weather);
                   const isBad = weather.temperature < 30 || weather.temperature > 90 || forecast.precipChance > 80 || forecast.hasThunderstorm;
                   return isBad ? 'warning.main' : 'success.main';
                })(),
                borderRadius: 4
              }}
            >
               <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                 {weather ? (() => {
                    const forecast = parseWeatherData(weather);
                    const isBad = weather.temperature < 30 || weather.temperature > 90 || forecast.precipChance > 80 || forecast.hasThunderstorm;
                    const isGreat = !isBad && forecast.precipChance < 20 && weather.temperature > 50 && weather.temperature < 75;
                    
                    return (
                      <>
                        <Typography variant="h3" fontWeight="900" sx={{ mb: 0.5, letterSpacing: '-1px' }}>
                          {isBad ? 'MAYBE' : 'YES!'}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="500" sx={{ opacity: 0.9, lineHeight: 1.2 }}>
                          {isBad ? 'Conditions are not ideal.' : isGreat ? 'It\'s a perfect day for a run!' : 'The park is open for you.'}
                        </Typography>
                      </>
                    );
                 })() : (
                   <Typography variant="h6">Loading...</Typography>
                 )}
               </CardContent>
            </Card>
          )}
        </Grid>

        {/* Weather Widget */}
        <Grid item xs={12}>
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
                          💨 {weather.windSpeed} • {weather.windDirection}
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
                 href="https://dressmyrun.com/place/40.80000,-73.97630"
                 target="_blank"
                 sx={{ display: { xs: 'none', sm: 'flex' } }}
               >
                 What to wear
               </Button>
               <Button 
                 variant="outlined"
                 size="small" 
                 href="https://dressmyrun.com/place/40.80000,-73.97630"
                 target="_blank"
                 sx={{ display: { xs: 'flex', sm: 'none' }, minWidth: 0, p: 1 }}
               >
                 <CheckroomIcon />
               </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Camera Widget */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 0, borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <VideocamIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">Live Loop (72nd St)</Typography>
              </Stack>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                component="a" 
                href="https://webcams.nyctmc.org/cameras-list"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                NYC DOT
              </Typography>
            </Box>
            <Box 
              sx={{ 
                width: '100%', 
                bgcolor: 'black',
                position: 'relative',
                paddingTop: '56.25%', // 16:9 Cinematic Ratio
              }}
            >
              <Box 
                component="img"
                src="https://webcams.nyctmc.org/api/cameras/3f04a686-f97c-4187-8968-cb09265e08ff/image"
                alt="Live Camera"
                sx={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%', 
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => e.target.style.display = 'none'}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Upcoming Events List */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
            <CalendarMonthIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              Upcoming Events
            </Typography>
          </Box>
          
          {futureEvents.length > 0 ? (
            <Stack spacing={2}>
              {futureEvents.map((event, index) => {
                const eventDate = dayjs(event.DATE);

                return (
                  <Card 
                    key={index} 
                    elevation={0} 
                    sx={{ 
                      borderRadius: 4, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        bgcolor: 'background.default',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Grid container alignItems="center" spacing={2}>
                        <Grid item xs={12} sm={3}>
                           <Box sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                             <Typography variant="subtitle1" fontWeight="bold" color="primary">
                               {eventDate.format('MMM D')}
                             </Typography>
                             <Typography variant="caption" color="text.secondary" fontWeight="bold">
                               {eventDate.format('dddd')}
                             </Typography>
                           </Box>
                        </Grid>
                        <Grid item xs={12} sm={9}>
                          <Stack spacing={0.5}>
                            <Typography 
                              variant="subtitle1" 
                              fontWeight="600" 
                              sx={{ lineHeight: 1.2, textDecoration: 'none', display: 'block' }}
                              component="a"
                              href={event.URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              color="text.primary"
                            >
                              {event.EVENT_NAME}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip label={event.START_TIME} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                              {event.LOCATION && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  📍 {event.LOCATION}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', borderRadius: 4 }} elevation={0}>
              <Typography color="text.secondary">
                No upcoming events found. Enjoy the open road!
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Footer */}
        <Grid item xs={12}>
          <Box sx={{ py: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
             <Typography variant="body2" color="text.secondary">
               Built for runners, by a runner and his AI agent friends.
             </Typography>
             <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
               <Link to="/about" style={{ color: '#666', textDecoration: 'none', fontSize: '0.875rem' }}>About</Link>
               <a href="https://github.com/minimumviablestack/central-park-run-calendar" target="_blank" rel="noreferrer" style={{ color: '#666', textDecoration: 'none', fontSize: '0.875rem' }}>GitHub</a>
             </Stack>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default EventList;
