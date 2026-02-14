import { useState, useEffect } from 'react';

const SETTINGS_KEY = 'park_run_calendar_settings';

const DEFAULT_SETTINGS = {
  units: 'us',
};

function useSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Error parsing settings:', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const setUnits = (newUnits) => {
    if (!newUnits) return;
    setSettings(prev => ({
      ...prev,
      units: newUnits
    }));
  };

  return {
    units: settings.units,
    setUnits
  };
}

export default useSettings;
