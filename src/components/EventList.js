import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/2025/events.csv');
        if (!response.ok) {
          throw new Error('Failed to fetch events data');
        }
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            // Sort events by date
            const sortedEvents = results.data.sort((a, b) => 
              new Date(a.date) - new Date(b.date)
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
    dayjs(event.date).isSameOrAfter(today, 'day')
  );
  
  // Separate today's events
  const todayEvents = upcomingEvents.filter(event => 
    dayjs(event.date).isSame(today, 'day')
  );
  
  // Future events (not today)
  const futureEvents = upcomingEvents.filter(event => 
    !dayjs(event.date).isSame(today, 'day')
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
        {todayEvents.length > 0 && (
          <>
            <Grid item xs={12}>
              <Typography variant="h6" color="info.main" sx={{ mt: 2, fontWeight: 'bold' }}>
                Today's Events
              </Typography>
            </Grid>
            
            {todayEvents.map((event, index) => (
              <Grid item xs={12} key={`today-${index}`}>
                <Card 
                  elevation={3}
                  sx={{
                    borderLeft: 4,
                    borderColor: 'info.main',
                    backgroundColor: 'info.light',
                    opacity: 0.9
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" color="info.dark" fontWeight="bold">
                      {event.event_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      Today | {event.time_range}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography 
                        component="a" 
                        href={event.event_url} 
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
            ))}
          </>
        )}

        {/* Upcoming events section */}
        {futureEvents.length > 0 && (
          <>
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" sx={{ mt: 2 }}>
                Upcoming Events
              </Typography>
            </Grid>
            
            {futureEvents.map((event, index) => {
              const eventDate = dayjs(event.date);
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
                        {event.event_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {eventDate.format('dddd, MMMM D, YYYY')} | {event.time_range}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography 
                          component="a" 
                          href={event.event_url} 
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
      </Grid>
    </Paper>
  );
}

export default EventList;