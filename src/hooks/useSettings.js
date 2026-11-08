import { useSyncExternalStore } from 'react';

const SETTINGS_KEY = 'park_run_calendar_settings';

const DEFAULT_SETTINGS = {
  units: 'us',
};

// Settings live in a module-level store (not per-component state) so every
// widget that calls useSettings() sees the same value — flipping °F/°C in the
// weather panel must update the week strip too.
const loadSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    console.error('Error parsing settings:', e);
  }
  return DEFAULT_SETTINGS;
};

let settings = loadSettings();
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => settings;

const updateSettings = (patch) => {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
  listeners.forEach((listener) => listener());
};

function useSettings() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setUnits = (newUnits) => {
    if (!newUnits) return;
    updateSettings({ units: newUnits });
  };

  return {
    units: current.units,
    setUnits
  };
}

export default useSettings;
