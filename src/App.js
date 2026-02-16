import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventList from './components/EventList';
import About from './components/About';
import InstallPrompt from './components/InstallPrompt';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Using a custom "Park" theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2e7d32', // Park Green
    },
    secondary: {
      main: '#546e7a', // Cool Blue-Grey
    },
    warning: {
      main: '#ed6c02',
      light: '#fff3e0', // Very soft orange for backgrounds
      dark: '#e65100',
    },
    success: {
      main: '#2e7d32',
      light: '#e8f5e9', // Very soft green for backgrounds
      dark: '#1b5e20',
    },
    background: {
      default: '#f4f6f4', // Very light green-gray
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16, // Softer corners
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <InstallPrompt />
      </Router>
    </ThemeProvider>
  );
}

export default App;