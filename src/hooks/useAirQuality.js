import { useState, useEffect } from 'react';

const AQI_ENDPOINT =
  'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=40.7790&longitude=-73.9692&current=us_aqi';

const AQI_CATEGORIES = [
  { max: 50, label: 'Good', color: '#4CAF50' },
  { max: 100, label: 'Moderate', color: '#FFEB3B' },
  { max: 150, label: 'Unhealthy (Sensitive)', color: '#FF9800' },
  { max: 200, label: 'Unhealthy', color: '#f44336' },
  { max: 300, label: 'Very Unhealthy', color: '#9C27B0' },
  { max: Infinity, label: 'Hazardous', color: '#7B1FA2' },
];

export function getAQICategory(aqi) {
  return AQI_CATEGORIES.find((c) => aqi <= c.max) || AQI_CATEGORIES[0];
}

export function useAirQuality() {
  const [aqi, setAqi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAQI = async () => {
      try {
        const response = await fetch(AQI_ENDPOINT);
        if (!response.ok) throw new Error('Failed to fetch AQI');
        const data = await response.json();
        setAqi(data.current?.us_aqi ?? null);
      } catch (err) {
        console.error('AQI fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAQI();
  }, []);

  return { aqi, loading, error, category: aqi ? getAQICategory(aqi) : null };
}
