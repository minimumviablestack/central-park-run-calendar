function formatSocrataTime(dt) {
  if (!dt || dt.length < 16) return '';
  const [h, m] = dt.slice(11, 16).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function isInsideCentralPark(parkingheld) {
  const held = (parkingheld || '').toUpperCase().replace(/CENTRAL PARK WEST/g, '');
  return held.includes('CENTRAL PARK');
}

function transformFilmPermits(rows) {
  return rows
    .filter((r) => r.startdatetime && isInsideCentralPark(r.parkingheld))
    .map((r) => ({
      name: `Film shoot: ${r.category || 'Production'}`,
      date: r.startdatetime.split('T')[0],
      startTime: formatSocrataTime(r.startdatetime),
      endTime: r.enddatetime ? formatSocrataTime(r.enddatetime) : '',
      location: 'Central Park (film shoot)',
      description: `${r.eventtype || 'Shooting Permit'} - ${r.category || 'Production'}`,
      url: 'https://data.cityofnewyork.us/City-Government/Film-Permits/tad4-ftjs',
      source: 'film-permits',
    }));
}

module.exports = { transformFilmPermits, formatSocrataTime };
