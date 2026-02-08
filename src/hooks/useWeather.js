import { useState, useEffect } from 'react';

const CENTRAL_PARK_COORDS = { lat: 40.7812, lon: -73.9665 };

/**
 * Parse weather data to extract precipitation chance, thunderstorm status, etc.
 * @param {Object} weather - Weather period data from NWS API
 * @returns {Object} Parsed weather conditions
 */
export const parseWeatherData = (weather) => {
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

/**
 * Custom hook for fetching weather data and alerts for Central Park
 * @returns {Object} Weather state and data
 */
function useWeather() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const pointResponse = await fetch(
          `https://api.weather.gov/points/${CENTRAL_PARK_COORDS.lat},${CENTRAL_PARK_COORDS.lon}`
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
          `https://api.weather.gov/alerts/active?point=${CENTRAL_PARK_COORDS.lat},${CENTRAL_PARK_COORDS.lon}`
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

  return {
    weather,
    weatherLoading,
    alerts
  };
}

export default useWeather;
