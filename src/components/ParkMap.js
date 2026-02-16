import React from 'react';
import { Box, Paper, useTheme } from '@mui/material';

const ParkMap = ({ highlightedSegments = [], affectedSegments = [], onSegmentClick }) => {
  const theme = useTheme();

  const getSegmentStyle = (id, type) => {
    const isHighlighted = highlightedSegments.includes(id);
    const isAffected = affectedSegments.includes(id);
    
    let stroke = '#e0e0e0';
    let strokeWidth = type === 'drive' ? 8 : type === 'transverse' ? 6 : 5;
    let dashArray = type === 'bridle' ? '8, 6' : 'none';

    if (isHighlighted) {
      stroke = theme.palette.primary.main;
      strokeWidth += 2;
    } else if (isAffected) {
      stroke = theme.palette.warning.main;
      dashArray = '10, 5';
    }

    return {
      stroke,
      strokeWidth,
      strokeDasharray: dashArray,
      transition: 'all 0.3s ease',
      cursor: onSegmentClick ? 'pointer' : 'default',
    };
  };

  const segments = [
    {
      id: 'drive_south',
      type: 'drive',
      d: 'M 30 400 L 30 440 Q 30 480 100 480 Q 170 480 170 440 L 170 400',
      label: 'Southern Drive, 1.44 miles'
    },
    {
      id: 'drive_east_mid',
      type: 'drive',
      d: 'M 170 400 L 170 100',
      label: 'East Drive, 1.75 miles'
    },
    {
      id: 'drive_north',
      type: 'drive',
      d: 'M 170 100 L 170 60 Q 170 20 100 20 Q 30 20 30 60 L 30 100',
      label: 'Northern Drive, 1.16 miles'
    },
    {
      id: 'drive_west_mid',
      type: 'drive',
      d: 'M 30 100 L 30 400',
      label: 'West Drive, 1.68 miles'
    },
    {
      id: 'transverse_72',
      type: 'transverse',
      d: 'M 30 300 L 170 300',
      label: '72nd St Transverse, 0.27 miles'
    },
    {
      id: 'transverse_102',
      type: 'transverse',
      d: 'M 30 100 L 170 100',
      label: '102nd St Transverse, 0.25 miles'
    },
    {
      id: 'reservoir',
      type: 'inner',
      d: 'M 100 150 A 40 60 0 1 0 100 270 A 40 60 0 1 0 100 150',
      label: 'Reservoir, 1.58 miles'
    },
    {
      id: 'bridle_path',
      type: 'bridle',
      d: 'M 100 140 A 50 75 0 1 0 100 280 A 50 75 0 1 0 100 140',
      label: 'Bridle Path, 1.66 miles'
    }
  ];

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        borderRadius: 4, 
        border: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ width: '100%', position: 'relative' }}>
        <svg
          viewBox="0 0 200 500"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(180, 30)">
            <line x1="0" y1="0" x2="0" y2="-15" stroke={theme.palette.text.secondary} strokeWidth="2" markerEnd="url(#arrowhead)" />
            <text x="0" y="10" textAnchor="middle" fontSize="10" fill={theme.palette.text.secondary} fontWeight="bold">N</text>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={theme.palette.text.secondary} />
              </marker>
            </defs>
          </g>

          {segments.map((seg) => (
            <path
              key={seg.id}
              d={seg.d}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-segment-id={seg.id}
              aria-label={seg.label}
              style={getSegmentStyle(seg.id, seg.type)}
              onClick={() => onSegmentClick?.(seg.id)}
            />
          ))}

          <g fontSize="10" fill={theme.palette.text.secondary} style={{ pointerEvents: 'none' }}>
            <text x="35" y="470" textAnchor="start">Columbus Circle</text>
            <text x="100" y="40" textAnchor="middle">Harlem Hill</text>
            <text x="100" y="215" textAnchor="middle" fontSize="9" fontWeight="bold">Reservoir</text>
            <text x="100" y="295" textAnchor="middle" fontSize="8">72nd St</text>
            <text x="100" y="95" textAnchor="middle" fontSize="8">102nd St</text>
          </g>
        </svg>
      </Box>
    </Paper>
  );
};

export default ParkMap;
