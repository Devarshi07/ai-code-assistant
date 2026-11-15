const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadNetwork, TimetableError } = require('../src/timetable');
const { UnknownStationError } = require('../src/network');
const { fewestStops } = require('../src/planner');
const { loadHarbourCity } = require('../src/samples');

/** True when some line runs straight from a to b, judged from the timetable data. */
function runsDirectly(network, a, b) {
  for (const line of network.lines.values()) {
    for (let i = 0; i + 1 < line.stations.length; i++) {
      const x = line.stations[i];
      const y = line.stations[i + 1];
      if ((x === a && y === b) || (!line.oneWay && y === a && x === b)) return true;
    }
  }
  return false;
}

function assertRoute(network, route, origin, destination, stops) {
  assert.ok(route, `riders can get from ${origin} to ${destination}`);
  assert.equal(route[0], origin);
  assert.equal(route[route.length - 1], destination);
  for (let i = 1; i < route.length; i++) {
    assert.ok(runsDirectly(network, route[i - 1], route[i]), `no line runs from ${route[i - 1]} to ${route[i]}`);
  }
  assert.equal(route.length - 1, stops, `${origin} to ${destination} is ${stops} stops, got ${route.join(' -> ')}`);
}

const connectionSet = connections => new Set(connections.map(c => `${c.to}|${c.line}|${c.minutes}`));

describe('quick routes', () => {
  test('outbound trip on the red line', () => {
    const network = loadHarbourCity();
    assertRoute(network, fewestStops(network, 'Airport', 'Museum'), 'Airport', 'Museum', 3);
  });

  test('return trip on the red line', () => {
    const network = loadHarbourCity();
    assertRoute(network, fewestStops(network, 'Museum', 'Airport'), 'Museum', 'Airport', 3);
  });

  test('riverside to university is two stops', () => {
    const network = loadHarbourCity();
    assertRoute(network, fewestStops(network, 'Riverside', 'University'), 'Riverside', 'University', 2);
  });

  test('round trips take the same number of stops', () => {
    const network = loadHarbourCity();
    for (const [a, b] of [['Airport', 'Museum'], ['University', 'Harbor'], ['City Hall', 'Airport'], ['Science Park', 'Old Town']]) {
      const there = fewestStops(network, a, b);
      const back = fewestStops(network, b, a);
      assert.ok(there, `${a} to ${b}`);
      assert.ok(back, `${b} to ${a}`);
      assert.equal(there.length, back.length, `${a} to ${b} and back should be the same length`);
    }
  });

  test('ferry only sails one way', () => {
    assert.deepEqual(fewestStops(loadHarbourCity(), 'Island Pier', 'Harbor'), ['Island Pier', 'Lighthouse', 'Harbor']);
  });

  test('same station is a zero-stop route', () => {
    assert.deepEqual(fewestStops(loadHarbourCity(), 'Central', 'Central'), ['Central']);
  });

  test('unknown station is reported', () => {
    assert.throws(() => fewestStops(loadHarbourCity(), 'Atlantis', 'Central'), UnknownStationError);
  });
});

describe('network', () => {
  test('two-way lines connect in both directions', () => {
    const connections = connectionSet(loadHarbourCity().connectionsFrom('Harbor'));
    assert.deepEqual(connections, new Set(['Central|Red|3', 'Museum|Red|6', 'Riverside|Green|6', 'Island Pier|Ferry|8']));
  });

  test('one-way line runs in timetable order only', () => {
    const connections = connectionSet(loadHarbourCity().connectionsFrom('Island Pier'));
    assert.deepEqual(connections, new Set(['Lighthouse|Ferry|5']));
  });

  test('neighbours of central', () => {
    assert.deepEqual(loadHarbourCity().neighbours('Central'), ['Airport', 'Harbor', 'Market Square', 'Old Town', 'University']);
  });

  test('lines calling at central', () => {
    assert.deepEqual(loadHarbourCity().linesAt('Central'), ['Red', 'Blue', 'Circle']);
  });
});

describe('timetable', () => {
  test('multi-word station names and minutes', () => {
    const circle = loadHarbourCity().lines.get('Circle');
    assert.deepEqual(circle.stations, ['Central', 'Market Square', 'City Hall', 'Old Town', 'Central']);
    assert.deepEqual(circle.minutes, [2, 2, 3, 2]);
    assert.equal(circle.oneWay, false);
  });

  test('oneway flag', () => {
    const ferry = loadHarbourCity().lines.get('Ferry');
    assert.equal(ferry.oneWay, true);
    assert.deepEqual(ferry.stations, ['Harbor', 'Island Pier', 'Lighthouse', 'Harbor']);
  });

  test('comments and blank lines are ignored', () => {
    const network = loadNetwork('# depot shuttle\n\nline Night Owl: Depot 12 Old Mill  # weekends\n');
    assert.deepEqual([...network.lines.keys()], ['Night Owl']);
    assert.deepEqual(network.lines.get('Night Owl').stations, ['Depot', 'Old Mill']);
  });

  test('malformed entries report their line number', () => {
    for (const entry of ['line Red Airport 4 Central', 'line Red: Airport 4', 'line Red: 4 Airport',
      'line Red: Airport', 'line Red: Airport 0 Central', 'line: Airport 4 Central']) {
      assert.throws(() => loadNetwork(`# header\n${entry}`), error => error instanceof TimetableError && error.lineNumber === 2, entry);
    }
  });

  test('duplicate line names are rejected', () => {
    assert.throws(() => loadNetwork('line Red: A 1 B\nline Red: C 1 D\n'), TimetableError);
  });
});
