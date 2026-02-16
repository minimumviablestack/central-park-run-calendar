import React, { useState, useEffect } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

const INSTALL_KEY = 'park_run_install_dismissed';
const VISIT_KEY = 'park_run_visit_count';

function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const visitCount = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) + 1;
      localStorage.setItem(VISIT_KEY, visitCount.toString());
      
      const dismissed = localStorage.getItem(INSTALL_KEY);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      if (visitCount >= 2 && !dismissed && !isStandalone) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(INSTALL_KEY, 'true');
  };

  if (!showPrompt) return null;

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1000,
        maxWidth: 500,
        mx: 'auto',
      }}
    >
      <Box sx={{ flex: 1, mr: 2 }}>
        <Typography variant="body2" fontWeight="600">
          Add to Home Screen
        </Typography>
        <Typography variant="caption" color="text.secondary">
          For quick access while running
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" onClick={handleDismiss}>
          Not now
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<GetAppIcon />}
          onClick={handleInstall}
        >
          Add
        </Button>
      </Box>
    </Paper>
  );
}

export default InstallPrompt;
