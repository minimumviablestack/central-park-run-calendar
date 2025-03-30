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
  Divider
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// Extend dayjs with the isSameOrAfter plugin
dayjs.extend(isSameOrAfter);

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Removed cameraTimestamp state

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

      <Grid container spacing={2}>
        {/* Today's events section */}
        <Grid item xs={12}>
          <Typography variant="h6" color="info.main" sx={{ mt: 2, fontWeight: 'bold' }}>
            Today in Central Park
          </Typography>
        </Grid>

        <Grid item xs={12}>
          {todayEvents.length > 0 ? (
            todayEvents.map((event, index) => (
              <Card 
                elevation={3}
                sx={{
                  borderLeft: 4,
                  borderColor: 'info.main',
                  backgroundColor: 'info.light',
                  opacity: 0.9
                }}
                key={`today-${index}`}
              >
                <CardContent>
                  <Typography variant="h6" color="info.dark" fontWeight="bold">
                    {event.EVENT_NAME}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold">
                    Today | {event.START_TIME}{event.END_TIME ? `-${event.END_TIME}` : ''}
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
            ))
          ) : (
            <Card 
              elevation={3}
              sx={{
                borderLeft: 4,
                borderColor: 'success.main',
                backgroundColor: 'success.light',
                textAlign: 'center',
                py: 4
              }}
            >
              <CardContent>
                <Typography variant="h1" color="success.dark" fontWeight="bold">
                  YES!
                </Typography>
                <Typography variant="h6" color="success.dark">
                  Great day for a run in the park
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Modified helpful links section - keeping only Weather link */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1 }}>
            <Typography 
              component="a" 
              href="https://dressmyrun.com/place/40.80000,-73.97630" 
              target="_blank" 
              rel="noopener noreferrer"
              color="primary"
              sx={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            >
              Weather & What to wear
            </Typography>
          </Box>
        </Grid>

        {/* Add DOT Camera View */}
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