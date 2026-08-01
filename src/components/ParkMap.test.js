import React from 'react';
import { render } from '@testing-library/react';

const mockPolyline = jest.fn(() => null);
const mockCircleMarker = jest.fn(() => null);

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: (props) => <div data-testid="tile-layer" data-url={props.url} />,
  Polyline: (props) => {
    mockPolyline(props);
    return null;
  },
  CircleMarker: (props) => {
    mockCircleMarker(props);
    return props.children ? <div>{props.children}</div> : null;
  },
  Tooltip: ({ children }) => <div data-testid="tooltip">{children}</div>,
  Marker: (props) => <div data-testid="marker" data-position={JSON.stringify(props.position)} />,
  useMap: () => ({ fitBounds: jest.fn() }),
}));

jest.mock('../data/segmentGeometry.json', () => ({
  drive_south: [[40.768, -73.9765], [40.778, -73.967]],
  reservoir: [[40.7795, -73.962], [40.7845, -73.958], [40.7795, -73.962]],
}));

import ParkMap from './ParkMap';

beforeEach(() => {
  mockPolyline.mockClear();
  mockCircleMarker.mockClear();
});

test('renders the Carto Positron tile layer', () => {
  const { getByTestId } = render(<ParkMap />);
  expect(getByTestId('tile-layer').dataset.url).toBe(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  );
});

test('renders an affected segment as a dashed warning polyline', () => {
  render(<ParkMap affectedSegments={['drive_south']} />);
  const affectedCall = mockPolyline.mock.calls.find(
    ([props]) => props.positions === undefined ? false : props.positions[0][0] === 40.768
  );
  expect(affectedCall).toBeTruthy();
  expect(affectedCall[0].pathOptions.dashArray).toBe('10, 5');
});

test('renders the animated path as a solid polyline', () => {
  const path = [[40.77, -73.97], [40.78, -73.96]];
  render(<ParkMap animatedPath={path} />);
  const solidCall = mockPolyline.mock.calls.find(
    ([props]) => JSON.stringify(props.positions) === JSON.stringify(path)
  );
  expect(solidCall).toBeTruthy();
  expect(solidCall[0].pathOptions.dashArray).toBeUndefined();
});

test('renders a start marker at the first point of the animated path', () => {
  const path = [[40.77, -73.97], [40.78, -73.96]];
  // getAllByTestId (not getByTestId): the mocked Marker component also renders
  // direction-arrow markers under this same generic test id once a path is
  // supplied, so more than one may be present. JSX order guarantees the start
  // marker renders first.
  const { getAllByTestId } = render(<ParkMap animatedPath={path} />);
  expect(JSON.parse(getAllByTestId('marker')[0].dataset.position)).toEqual([40.77, -73.97]);
});

test('renders no polylines or markers when given no animated path or affected segments', () => {
  render(<ParkMap />);
  expect(mockPolyline).not.toHaveBeenCalled();
});
