import React, { useMemo } from 'react';
import { Box, Paper, useTheme } from '@mui/material';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CENTRAL_PARK_BOUNDS = [
  [40.7649, -73.9810],
  [40.7968, -73.9490]
];

const FitBounds = ({ bounds }) => {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }, [map, bounds]);
  return null;
};

const ParkMap = ({ highlightedSegments = [], affectedSegments = [], onSegmentClick, compact = false }) => {
  const theme = useTheme();

  const segments = useMemo(() => ({
    drive_south: {
      id: 'drive_south',
      type: 'drive',
      coords: [
        [40.7680, -73.9765],
        [40.7700, -73.9745],
        [40.7730, -73.9715],
        [40.7755, -73.9690],
        [40.7780, -73.9670]
      ]
    },
    drive_east_mid: {
      id: 'drive_east_mid',
      type: 'drive',
      coords: [
        [40.7780, -73.9670],
        [40.7810, -73.9610],
        [40.7850, -73.9570],
        [40.7890, -73.9540],
        [40.7920, -73.9515]
      ]
    },
    drive_north: {
      id: 'drive_north',
      type: 'drive',
      coords: [
        [40.7920, -73.9515],
        [40.7945, -73.9510],
        [40.7965, -73.9525],
        [40.7955, -73.9560],
        [40.7930, -73.9590]
      ]
    },
    drive_west_mid: {
      id: 'drive_west_mid',
      type: 'drive',
      coords: [
        [40.7930, -73.9590],
        [40.7890, -73.9650],
        [40.7850, -73.9700],
        [40.7810, -73.9750],
        [40.7780, -73.9790]
      ]
    },
    transverse_72: {
      id: 'transverse_72',
      type: 'transverse',
      coords: [
        [40.7780, -73.9790],
        [40.7780, -73.9670]
      ]
    },
    transverse_102: {
      id: 'transverse_102',
      type: 'transverse',
      coords: [
        [40.7930, -73.9590],
        [40.7930, -73.9515]
      ]
    },
    reservoir: {
      id: 'reservoir',
      type: 'inner',
      coords: [
        [40.7795, -73.9620],
        [40.7815, -73.9595],
        [40.7845, -73.9580],
        [40.7875, -73.9585],
        [40.7895, -73.9605],
        [40.7905, -73.9640],
        [40.7895, -73.9675],
        [40.7865, -73.9695],
        [40.7825, -73.9690],
        [40.7795, -73.9620]
      ]
    },
    bridle_path: {
      id: 'bridle_path',
      type: 'bridle',
      coords: [
        [40.7770, -73.9635],
        [40.7800, -73.9595],
        [40.7840, -73.9570],
        [40.7885, -73.9575],
        [40.7915, -73.9600],
        [40.7925, -73.9645],
        [40.7910, -73.9690],
        [40.7875, -73.9710],
        [40.7825, -73.9705],
        [40.7770, -73.9635]
      ]
    }
  }), []);

  const getSegmentStyle = (segmentId, type) => {
    const isHighlighted = highlightedSegments.includes(segmentId);
    const isAffected = affectedSegments.includes(segmentId);

    if (isHighlighted) {
      return { color: theme.palette.primary.main, weight: 6, opacity: 1 };
    }
    if (isAffected) {
      return { color: theme.palette.warning.main, weight: 5, opacity: 0.8, dashArray: '10, 5' };
    }
    return { color: 'transparent', weight: 0, opacity: 0 };
  };

  const segmentList = Object.values(segments);

  // Hide polylines for now - to be re-enabled once coordinates are fixed
  const showRoutes = false;

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: compact ? 1.5 : 2, 
        borderRadius: 4, 
        border: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ width: '100%', height: compact ? 320 : 450, borderRadius: 2, overflow: 'hidden' }}>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {showRoutes && segmentList.map((seg) => (
            <Polyline
              key={seg.id}
              positions={seg.coords}
              pathOptions={getSegmentStyle(seg.id, seg.type)}
              eventHandlers={{
                click: () => onSegmentClick?.(seg.id)
              }}
            />
          ))}
        </MapContainer>
      </Box>
    </Paper>
  );
};

export default ParkMap;
