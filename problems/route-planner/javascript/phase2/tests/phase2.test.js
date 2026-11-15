const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadNetwork } = require('../src/timetable');
const { UnknownStationError } = require('../src/network');
const { fastestJourney } = require('../src/planner');
const { formatJourney } = require('../src/format');
const { loadHarbourCity } = require('../src/samples');

// Pier to Point: 12 min on Coastal with no change, or 4 min of riding on
// Hopper + Uptown with one change at Market.
const COAST = `
line Coastal: Pier 3 Beach 3 Cliffs 3 Dunes 3 Point
line Hopper: Pier 2 Market
line Uptown: Market 2 Point
`;

// The Shuttle reaches Bridge first, but only the Local continues to Quarry.
const VALLEY = `
line Local: Dock 2 Mill 2 Bridge 2 Quarry
line Shuttle: Dock 1 Depot 1 Bridge
`;

// The cable car only goes up, and the coast road is a separate network.
const MOUNTAIN = `
line Valley: North Gate 4 Mill 3 South Gate
line Cable Car oneway: Mill 12 Summit
line Coast Road: Harbour 6 Lighthouse
`;

/** Running time of one hop a -> b on the named line, read from the timetable data. */
function hopMinutes(network, lineName, a, b) {
  const line = network.lines.get(lineName);
  for (let i = 0; i < line.minutes.length; i++) {
    const x = line.stations[i];
    const y = line.stations[i + 1];
    if ((x === a && y === b) || (!line.oneWay && y === a && x === b)) return line.minutes[i];
  }
  return null;
}

/** Legs must chain from origin to destination over real hops, with consistent minutes. */
function assertValidJourney(network, journey, origin, destination, transferMinutes) {
  assert.ok(journey, `there is a journey from ${origin} to ${destination}`);
  assert.equal(journey.origin, origin);
  assert.equal(journey.destination, destination);
  assert.equal(journey.transferMinutes, transferMinutes);
  const legs = [...journey.legs];
  let here = origin;
  legs.forEach((leg, i) => {
    const stations = [...leg.stations];
    assert.ok(stations.length >= 2, `leg ${i + 1} must ride at least one hop`);
    assert.equal(stations[0], here, `leg ${i + 1} must start where the journey is`);
    if (i) assert.notEqual(leg.line, legs[i - 1].line, 'consecutive hops on one line belong in one leg');
    let riding = 0;
    for (let s = 1; s < stations.length; s++) {
      const minutes = hopMinutes(network, leg.line, stations[s - 1], stations[s]);
      assert.notEqual(minutes, null, `${leg.line} does not run from ${stations[s - 1]} to ${stations[s]}`);
      riding += minutes;
    }
    assert.equal(leg.minutes, riding, `leg ${i + 1} on ${leg.line} rides ${riding} min`);
    here = stations[stations.length - 1];
  });
  assert.equal(here, destination, 'the last leg must end at the destination');
  const changes = Math.max(legs.length - 1, 0);
  assert.equal(journey.transfers, changes);
  assert.equal(journey.totalMinutes, legs.reduce((sum, leg) => sum + leg.minutes, 0) + changes * transferMinutes);
}

const summary = journey => journey.legs.map(leg => [leg.line, [...leg.stations], leg.minutes]);

function plan(origin, destination, transferMinutes = 5, network = loadHarbourCity()) {
  const journey = fastestJourney(network, origin, destination, transferMinutes);
  assertValidJourney(network, journey, origin, destination, transferMinutes);
  return journey;
}

describe('fastestJourney', () => {
  test('single-line trip has no boarding penalty', () => {
    const journey = plan('Airport', 'Museum');
    assert.equal(journey.totalMinutes, 13);
    assert.deepEqual(summary(journey), [['Red', ['Airport', 'Central', 'Harbor', 'Museum'], 13]]);
  });

  test('default transfer penalty is five minutes', () => {
    const network = loadHarbourCity();
    const journey = fastestJourney(network, 'Airport', 'Science Park');
    assertValidJourney(network, journey, 'Airport', 'Science Park', 5);
    assert.equal(journey.totalMinutes, 17);
  });

  test('direct express beats changing lines', () => {
    const journey = plan('Airport', 'University');
    assert.equal(journey.totalMinutes, 9);
    assert.deepEqual(summary(journey), [['Express', ['Airport', 'University'], 9]]);
  });

  test('one transfer', () => {
    const journey = plan('Airport', 'Science Park');
    assert.deepEqual([journey.totalMinutes, journey.transfers], [17, 1]);
    assert.deepEqual(summary(journey), [['Express', ['Airport', 'University'], 9], ['Green', ['University', 'Science Park'], 3]]);
  });

  test('two transfers using the circle line', () => {
    const journey = plan('Old Town', 'Island Pier');
    assert.deepEqual([journey.totalMinutes, journey.transfers], [23, 2]);
    assert.deepEqual(summary(journey), [
      ['Circle', ['Old Town', 'Central'], 2],
      ['Red', ['Central', 'Harbor'], 3],
      ['Ferry', ['Harbor', 'Island Pier'], 8],
    ]);
  });

  test('custom transfer penalty', () => {
    const journey = plan('Old Town', 'Island Pier', 2);
    assert.deepEqual([journey.totalMinutes, journey.transfers], [17, 2]);
  });

  test('one-way ferry goes round the loop', () => {
    const journey = plan('Island Pier', 'Harbor');
    assert.equal(journey.totalMinutes, 15);
    assert.deepEqual(summary(journey), [['Ferry', ['Island Pier', 'Lighthouse', 'Harbor'], 15]]);
  });

  test('reverse of a one-way trip', () => {
    assert.equal(plan('Lighthouse', 'Museum').totalMinutes, 21);
    assert.equal(plan('Museum', 'Lighthouse').totalMinutes, 24);
  });

  test('transfer penalty decides the route', () => {
    const coast = loadNetwork(COAST);
    const cheap = plan('Pier', 'Point', 5, coast);
    assert.deepEqual([cheap.totalMinutes, cheap.legs.map(leg => leg.line)], [9, ['Hopper', 'Uptown']]);
    const costly = plan('Pier', 'Point', 10, coast);
    assert.deepEqual([costly.totalMinutes, costly.legs.map(leg => leg.line)], [12, ['Coastal']]);
  });

  test('equal times prefer fewer transfers', () => {
    // With an 8 minute change both routes take 12 minutes.
    const journey = plan('Pier', 'Point', 8, loadNetwork(COAST));
    assert.deepEqual([journey.totalMinutes, journey.transfers], [12, 0]);
  });

  test('free transfers', () => {
    const journey = plan('Pier', 'Point', 0, loadNetwork(COAST));
    assert.deepEqual([journey.totalMinutes, journey.transfers], [4, 1]);
  });

  test('staying on board can beat an earlier arrival', () => {
    const valley = loadNetwork(VALLEY);
    const journey = plan('Dock', 'Quarry', 5, valley);
    assert.equal(journey.totalMinutes, 6);
    assert.deepEqual(summary(journey), [['Local', ['Dock', 'Mill', 'Bridge', 'Quarry'], 6]]);
    assert.equal(plan('Dock', 'Bridge', 5, valley).totalMinutes, 2);
  });

  test('same origin and destination', () => {
    const journey = plan('Central', 'Central');
    assert.deepEqual([...journey.legs], []);
    assert.equal(journey.totalMinutes, 0);
  });

  test('unreachable destination returns null', () => {
    const mountain = loadNetwork(MOUNTAIN);
    assert.equal(plan('North Gate', 'Summit', 5, mountain).totalMinutes, 21);
    assert.equal(fastestJourney(mountain, 'Summit', 'Mill'), null);
    assert.equal(fastestJourney(mountain, 'North Gate', 'Lighthouse'), null);
  });

  test('unknown station throws', () => {
    assert.throws(() => fastestJourney(loadHarbourCity(), 'Airport', 'Atlantis'), UnknownStationError);
  });

  test('journey card text', () => {
    const journey = fastestJourney(loadHarbourCity(), 'Airport', 'Science Park');
    assert.equal(formatJourney(journey),
      'Take Express from Airport to University (9 min), transfer (5 min), ' +
      'take Green from University to Science Park (3 min). Total 17 min, 1 transfer.');
  });
});
