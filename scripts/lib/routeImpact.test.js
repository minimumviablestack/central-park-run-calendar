const test = require('node:test');
const assert = require('node:assert');
const { isRouteImpacting } = require('./routeImpact');

test('NYRR race is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'NYRR Joe Kleinerman 10K',
    location: 'Central Park',
    description: 'NYRR Race'
  }), true);
});

test('bike race with generic park location is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Grand Prix Bike Race',
    location: 'Central Park',
    description: 'Cycling event'
  }), true);
});

test('parade with empty location is route-impacting (parades use the drives)', () => {
  assert.equal(isRouteImpacting({
    name: 'Heritage Parade',
    location: '',
    description: 'Annual parade'
  }), true);
});

test('film shoot on the park is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Film shoot: Television',
    location: 'Central Park (film shoot)',
    description: 'Shooting Permit - Television'
  }), true);
});

test('concert explicitly on a drive is route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Summer Concert',
    location: 'East Drive at 90th St',
    description: 'Concert'
  }), true);
});

test('Great Lawn concert without drive mention is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'SummerStage Concert',
    location: 'Great Lawn',
    description: 'Concert'
  }), false);
});

test('museum event is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Museum Mile Festival',
    location: 'Fifth Avenue',
    description: 'Museum open house'
  }), false);
});

test('birdwalk is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Saturday Birdwalk',
    location: 'The Ramble',
    description: 'Guided birdwalk'
  }), false);
});

test('playground event is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Family Day',
    location: 'Heckscher Playground',
    description: 'Kids activities'
  }), false);
});

test('lawn closure is NOT route-impacting', () => {
  assert.equal(isRouteImpacting({
    name: 'Sheep Meadow Lawn Closure',
    location: 'Sheep Meadow',
    description: 'Lawn closure'
  }), false);
});
