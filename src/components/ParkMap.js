import React, { useMemo } from 'react';
import { Box, Paper, useTheme } from '@mui/material';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import segmentGeometry from '../data/segmentGeometry.json';
import { getMileMarkers, getDirectionArrows } from '../utils/geoMath';

const CENTRAL_PARK_BOUNDS = [
  [40.7649, -73.9810],
  [40.7968, -73.9490],
];

const FitBounds = ({ bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }, [map, bounds]);
  return null;
};

const arrowIcon = (bearing) =>
  L.divIcon({
    html: `<div style="transform: rotate(${bearing}deg); font-size: 16px; line-height: 16px; color: #2e7d32;">&#9650;</div>`,
    className: 'route-direction-arrow',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const startIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#2e7d32;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>',
  className: 'route-start-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const ParkMap = ({ animatedPath = [], affectedSegments = [] }) => {
  const theme = useTheme();

  const affectedCoords = useMemo(
    () => affectedSegments.map((id) => segmentGeometry[id]).filter(Boolean),
    [affectedSegments]
  );

  const mileMarkers = useMemo(
    () => (animatedPath.length > 1 ? getMileMarkers(animatedPath) : []),
    [animatedPath]
  );

  const arrows = useMemo(
    () => (animatedPath.length > 1 ? getDirectionArrows(animatedPath) : []),
    [animatedPath]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ width: '100%', height: 450, borderRadius: 2, overflow: 'hidden' }}>
        <MapContainer
          center={[40.7812, -73.9665]}
          zoom={14}
          zoomControl={true}
          dragging={true}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBounds bounds={CENTRAL_PARK_BOUNDS} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {affectedCoords.map((coords, i) => (
            <Polyline
              key={`affected-${i}`}
              positions={coords}
              pathOptions={{
                color: theme.palette.warning.main,
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5',
              }}
            />
          ))}

          {animatedPath.length > 1 && (
            <Polyline
              positions={animatedPath}
              pathOptions={{ color: theme.palette.primary.main, weight: 6, opacity: 1 }}
            />
          )}

          {animatedPath.length > 0 && <Marker position={animatedPath[0]} icon={startIcon} />}

          {arrows.map((arrow, i) => (
            <Marker key={`arrow-${i}`} position={arrow.position} icon={arrowIcon(arrow.bearing)} />
          ))}

          {mileMarkers.map((marker) => (
            <CircleMarker
              key={`mile-${marker.mile}`}
              center={marker.position}
              radius={5}
              pathOptions={{ color: theme.palette.text.primary, fillColor: '#fff', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip permanent direction="top" offset={[0, -6]}>
                {marker.mile} mi
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
    </Paper>
  );
};

export default ParkMap;
