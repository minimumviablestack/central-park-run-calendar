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
  Button,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VideocamIcon from '@mui/icons-material/Videocam';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GoogleIcon from '@mui/icons-material/Google';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import useWeather from '../hooks/useWeather';
import WeatherAlerts from './WeatherAlerts';
import WeatherWidget from './WeatherWidget';
import HeroStatus from './HeroStatus';
import RoutePlanner from './RoutePlanner';
import BestWindowCard from './BestWindowCard';
import AQIBadge from './AQIBadge';
import WeekStrip from './WeekStrip';
import { getSunriseSunset, formatTime } from '../utils/sunCalc';
import { downloadICS, getGoogleCalendarUrl } from '../utils/calendarExport';

dayjs.extend(isSameOrAfter);

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const { weather, weatherLoading, alerts, hourlyForecast } = useWeather();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleTabChange = (_, newValue) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/events.csv');
        if (!response.ok) {
          throw new Error('Failed to fetch events data');
        }
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
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
  
  const upcomingEvents = events.filter(event => 
    dayjs(event.DATE).isSameOrAfter(today, 'day')
  );
  
  const todayEvents = upcomingEvents.filter(event => 
    dayjs(event.DATE).isSame(today, 'day')
  );
  
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

      {isMobile && (
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab label="Overview" />
          <Tab label="Plan" />
        </Tabs>
      )}

      <Grid container spacing={2}>
        {(!isMobile || tabValue === 0) && (
          <React.Fragment>
        {/* Weather Alerts */}
        {alerts.length > 0 && (
          <Grid item xs={12}>
            <WeatherAlerts alerts={alerts} />
          </Grid>
        )}

        <Grid item xs={12}>
          <HeroStatus todayEvents={todayEvents} weather={weather} />
        </Grid>

        <Grid item xs={12}>
          <BestWindowCard events={todayEvents} hourlyForecast={hourlyForecast} />
        </Grid>

        {/* Weather Widget */}
        <Grid item xs={12}>
          <WeatherWidget weather={weather} weatherLoading={weatherLoading} />
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

        {/* Week Strip */}
        <Grid item xs={12}>
          <WeekStrip events={upcomingEvents} hourlyForecast={hourlyForecast} />
        </Grid>

        {/* Route Planner */}
        <Grid item xs={12}>
          <RoutePlanner todayEvents={todayEvents} />
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
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<EventAvailableIcon sx={{ fontSize: 14 }} />}
                                onClick={() => downloadICS(event)}
                                sx={{ fontSize: '0.7rem', py: 0, minHeight: 24 }}
                              >
                                Add to Calendar
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<GoogleIcon sx={{ fontSize: 14 }} />}
                                component="a"
                                href={getGoogleCalendarUrl(event)}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: '0.7rem', py: 0, minHeight: 24 }}
                              >
                                Google
                              </Button>
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
        </React.Fragment>
        )}

        {isMobile && tabValue === 1 && (
          <>
          <Grid item xs={12}>
            <RoutePlanner todayEvents={todayEvents} />
          </Grid>
          <Grid item xs={12}>
            <WeekStrip events={upcomingEvents} hourlyForecast={hourlyForecast} />
          </Grid>
        </>
        )}

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
