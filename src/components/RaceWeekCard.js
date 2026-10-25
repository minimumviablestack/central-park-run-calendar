import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getActiveRaceWeek } from '../utils/raceWeek';

function RaceWeekCard() {
  const raceWeek = getActiveRaceWeek();
  if (!raceWeek) return null;

  return (
    <Paper
      component="section"
      aria-label={`${raceWeek.name} week`}
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        gap: 2,
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, flex: 1 }}>
        <EmojiEventsOutlinedIcon color="primary" sx={{ mt: '2px' }} aria-hidden="true" />
        <Box>
          <Typography variant="subtitle1" component="h2" fontWeight="bold">
            It's {raceWeek.name} week
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {raceWeek.note}
          </Typography>
        </Box>
      </Box>
      <Button
        variant="outlined"
        href={raceWeek.url}
        target="_blank"
        rel="noopener noreferrer"
        endIcon={<OpenInNewIcon />}
        sx={{ textTransform: 'none', flexShrink: 0, ml: { xs: 4.5, sm: 0 } }}
      >
        See race-week events
      </Button>
    </Paper>
  );
}

export default RaceWeekCard;
