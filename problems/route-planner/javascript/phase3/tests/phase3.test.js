const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { loadNetwork } = require('../src/timetable');
const { fastestJourney } = require('../src/planner');
const { generateTimetable, pickQueries } = require('./generator');

// Reference results on the medium network, checked against an independent
// brute-force planner: [origin, destination, transfer minutes,
// [total minutes, transfers] or null when unreachable].
const MEDIUM_CASES = [
  ['S18-21', 'S9-8', 5, [139, 8]],
  ['S17-12', 'S13-1', 0, [47, 4]],
  ['S1-19', 'S2-2', 10, [67, 2]],
  ['S23-3', 'S4-16', 2, null],
  ['S13-1', 'S5-21', 5, [78, 3]],
  ['S11-15', 'S2-20', 0, [59, 8]],
  ['S2-1', 'S7-4', 10, [43, 2]],
  ['S19-16', 'S22-13', 2, [17, 1]],
  ['S5-5', 'S13-18', 5, [215, 10]],
  ['S6-15', 'S16-22', 0, [70, 8]],
  ['S2-4', 'S13-17', 10, [243, 8]],
  ['S12-17', 'S1-20', 2, [145, 10]],
];

const BATCH_SIZE = 30;
const BATCH_LIMIT_MS = 1000;

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
  assert.equal(journey.origin, origin);
  assert.equal(journey.destination, destination);
  const legs = [...journey.legs];
  let here = origin;
  legs.forEach((leg, i) => {
    const stations = [...leg.stations];
    assert.ok(stations.length >= 2);
    assert.equal(stations[0], here, `leg ${i + 1} must start where the journey is`);
    if (i) assert.notEqual(leg.line, legs[i - 1].line, 'consecutive hops on one line belong in one leg');
    let riding = 0;
    for (let s = 1; s < stations.length; s++) {
      const minutes = hopMinutes(network, leg.line, stations[s - 1], stations[s]);
      assert.notEqual(minutes, null, `${leg.line} does not run from ${stations[s - 1]} to ${stations[s]}`);
      riding += minutes;
    }
    assert.equal(leg.minutes, riding);
    here = stations[stations.length - 1];
  });
  assert.equal(here, destination);
  const changes = Math.max(legs.length - 1, 0);
  assert.equal(journey.transfers, changes);
  assert.equal(journey.totalMinutes, legs.reduce((sum, leg) => sum + leg.minutes, 0) + changes * transferMinutes);
}

describe('scale', () => {
  test('medium network matches reference results', () => {
    const network = loadNetwork(generateTimetable(11, 24, 40, 8, 20).text);
    for (const [origin, destination, transfer, expected] of MEDIUM_CASES) {
      const journey = fastestJourney(network, origin, destination, transfer);
      const label = `${origin} to ${destination} with ${transfer} min transfers`;
      if (expected === null) {
        assert.equal(journey, null, label);
        continue;
      }
      assert.ok(journey, label);
      assertValidJourney(network, journey, origin, destination, transfer);
      assert.deepEqual([journey.totalMinutes, journey.transfers], expected, label);
    }
  });

  test('regional network batch is fast', () => {
    const { text, stations } = generateTimetable(3, 80, 320, 20, 50);
    const network = loadNetwork(text); // about 5,100 stations and 320 lines
    const queries = pickQueries(17, stations, BATCH_SIZE);

    const start = performance.now();
    const journeys = queries.map(([origin, destination]) => fastestJourney(network, origin, destination));
    const elapsed = performance.now() - start;

    queries.forEach(([origin, destination], i) => {
      assert.ok(journeys[i], `${origin} to ${destination}`);
      assertValidJourney(network, journeys[i], origin, destination, 5);
    });
    assert.deepEqual([journeys[0].totalMinutes, journeys[0].transfers], [116, 6]);
    assert.equal(journeys.reduce((sum, j) => sum + j.totalMinutes, 0), 3144);
    assert.equal(journeys.reduce((sum, j) => sum + j.transfers, 0), 150);
    assert.ok(elapsed < BATCH_LIMIT_MS, `${BATCH_SIZE} queries took ${elapsed.toFixed(0)}ms; the batch must finish in under ${BATCH_LIMIT_MS}ms`);
  });
});
