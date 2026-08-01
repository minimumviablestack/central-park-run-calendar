import { buildGpxString } from './gpxExport';

const PATH = [
  [40.77, -73.97],
  [40.78, -73.96],
];

test('includes the gpx and trk wrapper elements', () => {
  const gpx = buildGpxString('Southern Loop', PATH);
  expect(gpx).toContain('<gpx');
  expect(gpx).toContain('<trk>');
  expect(gpx).toContain('<trkseg>');
});

test('includes one trkpt per coordinate with correct lat/lon', () => {
  const gpx = buildGpxString('Southern Loop', PATH);
  expect(gpx).toContain('lat="40.77" lon="-73.97"');
  expect(gpx).toContain('lat="40.78" lon="-73.96"');
  expect((gpx.match(/<trkpt/g) || []).length).toBe(2);
});

test('escapes special characters in the route name', () => {
  const gpx = buildGpxString('Loop & "Trail" <test>', PATH);
  expect(gpx).toContain('Loop &amp; &quot;Trail&quot; &lt;test&gt;');
});
