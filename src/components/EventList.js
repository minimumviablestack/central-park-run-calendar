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
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// Extend dayjs with the isSameOrAfter plugin
dayjs.extend(isSameOrAfter);

// Add these helper functions at the beginning of EventList component
  const getMinWindSpeed = (windSpeedStr) => {
    if (!windSpeedStr) return 0;
    const match = windSpeedStr.match(/(\d+)\s*to/);
    return match ? parseInt(match[1]) : 0;
  };

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

    fetchWeather();
  }, []);

  // Removed useEffect for camera refresh

  if (loading) {
    return (
      <Paper elevation={3} sx={{ maxWidth: 800, margin: '20px auto', padding: 2, textAlign: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={3} sx={{ maxWidth: 800, margin: '20px auto', padding: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
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
    <Paper elevation={3} sx={{ maxWidth: 800, margin: '20px auto', padding: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DirectionsRunIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h5" gutterBottom sx={{ flex: 1 }}>
          Should I run in the park today?
        </Typography>
      </Box>

      <Grid container spacing={1}>  {/* Reduced from spacing={2} */}
        {/* Today's events section header */}
        {todayEvents.length > 0 ? <Grid item xs={12}>
          <Typography variant="h6" color="info.main" sx={{ mt: 1, fontWeight: 'bold' }}>  {/* Reduced from mt: 2 */}
            Today in Central Park
          </Typography>
        </Grid>:<></>}

        {/* Today's events section */}
        <Grid item xs={12} sx={{ '& > .MuiCard-root': { mb: 0.5 } }}>  {/* Reduced margin between cards */}
          {todayEvents.length > 0 ? (
            todayEvents.map((event, index) => (
              <Card 
                elevation={3}
                sx={{
                  borderLeft: 4,
                  borderColor: 'info.main',
                  backgroundColor: 'info.light',
                  opacity: 0.9,
                  '&:last-child': { mb: 0 }
                }}
                key={`today-${index}`}
              >
                <CardContent sx={{ py: 1.5, px: 2 }}>  {/* Reduced vertical padding */}
                  <Typography variant="h6" color="info.dark" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {event.EVENT_NAME}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        Today | {event.START_TIME}{event.END_TIME ? `-${event.END_TIME}` : ''}
                      </Typography>
                      {event.LOCATION && (
                        <Typography variant="body2" color="text.secondary">
                          Location: {event.LOCATION}
                        </Typography>
                      )}
                    </Box>
                    <Typography 
                      component="a" 
                      href={event.URL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      color="primary"
                      sx={{ textDecoration: 'none', ml: 2, whiteSpace: 'nowrap' }}
                    >
                      Event Details →
                    </Typography>
                  </Box>
                  {event.DESCRIPTION && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {event.DESCRIPTION.substring(0, 100)}{event.DESCRIPTION.length > 100 ? '...' : ''}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card 
              elevation={3}
              sx={{
                borderLeft: 4,
                borderColor: weather && (() => {
                  const forecast = parseWeatherData(weather);
                  return (
                    weather.temperature < 30 || 
                    weather.temperature > 90 ||
                    forecast.precipChance > 80 ||
                    forecast.hasThunderstorm ||
                    forecast.rainfall > 3 ||
                    forecast.windGust > 30 ||
                    getMinWindSpeed(weather.windSpeed) > 20
                  ) ? 'warning.main' : 'success.main'
                })(),
                backgroundColor: weather && (() => {
                  const forecast = parseWeatherData(weather);
                  return (
                    weather.temperature < 30 || 
                    weather.temperature > 90 ||
                    forecast.precipChance > 80 ||
                    forecast.hasThunderstorm ||
                    forecast.rainfall > 3 ||
                    forecast.windGust > 30 ||
                    getMinWindSpeed(weather.windSpeed) > 20
                  ) ? 'warning.light' : 'success.light'
                })(),
                textAlign: 'center',
                height: '100%'
              }}
            >
              <CardContent>
                {weather && (() => {
                  const forecast = parseWeatherData(weather);
                  const isBadWeather = 
                    weather.temperature < 30 || 
                    weather.temperature > 90 ||
                    forecast.precipChance > 80 ||
                    forecast.hasThunderstorm ||
                    forecast.rainfall > 3 ||
                    forecast.windGust > 25 ||
                    getMinWindSpeed(weather.windSpeed) > 20;

                  return (
                    <>
                      <Typography variant="h3" color={isBadWeather ? 'warning.dark' : 'success.dark'} fontWeight="bold">
                        {isBadWeather ? 'MAYBE' : 'YES!'}
                      </Typography>
                      <Typography variant="h6" color={isBadWeather ? 'warning.dark' : 'success.dark'}>
                        {weather.temperature < 30 ? 'It\'s pretty cold out there' :
                         weather.temperature > 90 ? 'It\'s pretty hot out there' :
                         forecast.hasThunderstorm ? 'Thunderstorms expected' :
                         forecast.precipChance > 80 ? 'High chance of precipitation' :
                         forecast.rainfall > 3 ? 'Heavy rainfall expected' :
                         forecast.windGust > 25 ? 'Strong wind gusts expected' :
                         getMinWindSpeed(weather.windSpeed) > 20 ? 'Strong winds today' :
                         'Great day for a run in the park'}
                      </Typography>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Weather information and clothing recommendation link */}
        <Grid container item xs={12} spacing={1} sx={{ mt: 0 }}>
          <Grid item xs={12} md={8}>
            <Card elevation={2} sx={{ height: '90px' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
                {weatherLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, width: '100%' }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : weather ? (
                  <>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', mb: 'auto' }}>
                      <Typography variant="h3" sx={{ mr: 3, textAlign: 'center', minWidth: '140px' }}>
                        {weather.temperature}°F
                      </Typography>
                      <Box>
                        <Typography variant="body1" sx={{ mb: 0.5 }}>
                          {weather.shortForecast}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {weather.windSpeed} {weather.windDirection}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontSize: '0.7rem' }}>
                      Data: <Typography 
                        component="a" 
                        href="https://www.weather.gov/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        color="text.secondary"
                        sx={{ textDecoration: 'underline', fontSize: '0.7rem' }}
                      >
                        National Weather Service
                      </Typography>
                    </Typography>
                  </>
                ) : (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', width: '100%' }}>
                    Weather data unavailable
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Remove the separate attribution Grid item */}
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={{ height: '90px' }}>
              <CardContent sx={{ 
                height: '100%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <Typography 
                  component="a" 
                  href="https://dressmyrun.com/place/40.80000,-73.97630" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  color="primary"
                  sx={{ 
                    textDecoration: 'none', 
                    display: 'flex', 
                    alignItems: 'center',
                    '&:hover': { opacity: 0.8 }
                  }}
                >
                  What to wear →
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {/* Remove this Grid item with the duplicate attribution */}
          {/* <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
              Weather Data: <Typography 
                component="a" 
                href="https://www.weather.gov/" 
                target="_blank" 
                rel="noopener noreferrer"
                color="text.secondary"
                sx={{ textDecoration: 'underline' }}
              >
                National Weather Service
              </Typography>
            </Typography>
          </Grid> */}
        </Grid>

        {/* DOT Camera View */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ mt: 2, mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 1 }}>
                Loop Condition @ 72nd St
              </Typography>
              <Box sx={{ 
                position: 'relative', 
                width: '100%', 
                height: 0, 
                paddingBottom: '56.25%', 
                overflow: 'hidden' 
              }}>
                <Box 
                  component="img"
                  src="https://webcams.nyctmc.org/api/cameras/3f04a686-f97c-4187-8968-cb09265e08ff/image"
                  alt="Central Park @ 72nd St Post 37 - Live Camera"
                  sx={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    border: '1px solid #eee',
                    borderRadius: 1
                  }}
                  onError={(e) => {
                    console.error('Failed to load traffic camera image');
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
                Source: <Typography 
                  component="a" 
                  href="https://webcams.nyctmc.org/cameras-list" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  color="text.secondary"
                  sx={{ textDecoration: 'underline' }}
                >
                  NYC DOT Traffic Camera
                </Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming events section */}
        {futureEvents.length > 0 && (
          <>
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mt: 2 }}>
                Upcoming Events
              </Typography>
            </Grid>
            
            {futureEvents.map((event, index) => {
              const eventDate = dayjs(event.DATE);
              const isThisWeek = eventDate.diff(today, 'day') < 7;
              
              return (
                <Grid item xs={12} key={`future-${index}`}>
                  <Card 
                    elevation={isThisWeek ? 2 : 1}
                    sx={{
                      borderLeft: isThisWeek ? 2 : 0,
                      borderColor: 'primary.main',
                      backgroundColor: isThisWeek ? 'action.hover' : 'background.paper'
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" color="primary">
                        {event.EVENT_NAME}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {eventDate.format('dddd, MMMM D, YYYY')} | {event.START_TIME}{event.END_TIME ? `-${event.END_TIME}` : ''}
                      </Typography>
                      {event.LOCATION && (
                        <Typography variant="body2" color="text.secondary">
                          Location: {event.LOCATION}
                        </Typography>
                      )}
                      {event.DESCRIPTION && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {event.DESCRIPTION.substring(0, 100)}{event.DESCRIPTION.length > 100 ? '...' : ''}
                        </Typography>
                      )}
                      <Box sx={{ mt: 1 }}>
                        <Typography 
                          component="a" 
                          href={event.URL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          color="primary"
                          sx={{ textDecoration: 'none' }}
                        >
                          Event Details →
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </>
        )}
        
        {/* No events message */}
        {upcomingEvents.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="success">
              No upcoming events! It's a great time to run in the park.
            </Alert>
          </Grid>
        )}
        
        {/* Footer links - GitHub and About moved here */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 3, 
            mt: 4, 
            pt: 2,
            borderTop: '1px solid #eee'
          }}>
            <Typography 
              component="a" 
              href="https://github.com/minimumviablestack/central-park-run-calendar" 
              target="_blank" 
              rel="noopener noreferrer"
              color="text.secondary"
              sx={{ textDecoration: 'none', fontSize: '0.875rem' }}
            >
              GitHub
            </Typography>
            <Typography 
              component={Link} 
              to="/about"
              color="text.secondary"
              sx={{ textDecoration: 'none', fontSize: '0.875rem' }}
            >
              About
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default EventList;
