import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TerrainIcon from '@mui/icons-material/Terrain';
import ParkMap from './ParkMap';
import { suggestRoutes, getPresets } from '../utils/routeEngine';
import { getAffectedSegments } from '../utils/eventRouteMapping';

const SURFACE_LABELS = {
  asphalt: 'Paved',
  gravel: 'Gravel',
  dirt: 'Trail',
};

const ELEVATION_ICONS = {
  flat: null,
  rolling: 'Rolling',
  hilly: 'Hilly',
};

function RoutePlanner({ todayEvents = [] }) {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  const presets = getPresets();
  const affectedSegmentIds = useMemo(
    () => getAffectedSegments(todayEvents),
    [todayEvents]
  );

  const routes = useMemo(() => {
    if (!selectedPreset) return [];
    return suggestRoutes(
      selectedPreset.target_mi,
      selectedPreset.tolerance_mi,
      affectedSegmentIds
    );
  }, [selectedPreset, affectedSegmentIds]);

  const activeRoute = routes[selectedRouteIdx] || null;

  const handlePresetChange = (_, value) => {
    if (!value) {
      setSelectedPreset(null);
      setSelectedRouteIdx(0);
      return;
    }
    const preset = presets.find(p => p.label === value);
    setSelectedPreset(preset || null);
    setSelectedRouteIdx(0);
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <RouteIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            Plan Your Route
          </Typography>
        </Stack>

        <Box sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
          <ToggleButtonGroup
            value={selectedPreset?.label || null}
            exclusive
            onChange={handlePresetChange}
            size="small"
            sx={{
              flexWrap: 'nowrap',
              '& .MuiToggleButton-root': {
                px: { xs: 1.5, sm: 2 },
                py: 0.5,
                fontSize: '0.8rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                borderRadius: '20px !important',
                border: '1px solid',
                borderColor: 'divider',
                mx: 0.25,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderColor: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                },
              },
            }}
          >
            {presets.map(p => (
              <ToggleButton key={p.label} value={p.label}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <ParkMap
          highlightedSegments={activeRoute?.segmentIds || []}
          affectedSegments={affectedSegmentIds}
        />

        {routes.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="500">
              {routes.length} route{routes.length !== 1 ? 's' : ''} found
            </Typography>
            {routes.map((route, idx) => (
              <Card
                key={route.name}
                elevation={0}
                onClick={() => setSelectedRouteIdx(idx)}
                sx={{
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: idx === selectedRouteIdx ? 'primary.main' : 'divider',
                  borderRadius: 3,
                  bgcolor: idx === selectedRouteIdx ? 'success.light' : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'primary.light',
                  },
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        noWrap
                      >
                        {route.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip
                          label={`${route.distance_mi} mi`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                        {route.surfaces.map(s => (
                          <Chip
                            key={s}
                            label={SURFACE_LABELS[s] || s}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        ))}
                        {route.elevation !== 'flat' && (
                          <Chip
                            icon={<TerrainIcon sx={{ fontSize: 14 }} />}
                            label={ELEVATION_ICONS[route.elevation]}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        )}
                      </Stack>
                    </Box>
                    <Box sx={{ ml: 1, flexShrink: 0 }}>
                      {route.isAffected ? (
                        <Chip
                          icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                          label="Event"
                          size="small"
                          color="warning"
                          sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                          label="Clear"
                          size="small"
                          color="success"
                          sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {selectedPreset && routes.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No routes match this distance. Try a different option.
            </Typography>
          </Box>
        )}

        {!selectedPreset && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Select a distance to see route suggestions
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default RoutePlanner;
