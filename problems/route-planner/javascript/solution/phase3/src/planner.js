// Journey planning over a Network.
const { DEFAULT_TRANSFER_MINUTES, Journey, Leg } = require('./models');
const { MinHeap } = require('./heap');

// The line of the starting state: the rider has not boarded anything yet.
const NOT_BOARDED = '';

/**
 * Breadth-first search for the route with the fewest stops, ignoring lines.
 *
 * Powers the "quick route" panel in the rider app. Returns the station names
 * from origin to destination inclusive, or null when there is no route.
 * Unknown station names throw UnknownStationError.
 */
function fewestStops(network, origin, destination) {
  network.station(origin);
  network.station(destination);
  if (origin === destination) return [origin];
  const cameFrom = new Map([[origin, null]]);
  const queue = [origin];
  for (let head = 0; head < queue.length; head++) {
    for (const connection of network.connectionsFrom(queue[head])) {
      const next = connection.to;
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, queue[head]);
      if (next === destination) return walkBack(cameFrom, next);
      queue.push(next);
    }
  }
  return null;
}

function walkBack(cameFrom, station) {
  const route = [station];
  for (let previous = cameFrom.get(station); previous !== null; previous = cameFrom.get(previous)) {
    route.push(previous);
  }
  return route.reverse();
}

/** Map key for a (station, line) search state. Newlines never appear in names. */
function stateKey(station, line) {
  return `${station}\n${line}`;
}

/** Search order: fewer minutes, then fewer transfers, then station and line name. */
function comesBefore(a, b) {
  if (a.minutes !== b.minutes) return a.minutes < b.minutes;
  if (a.transfers !== b.transfers) return a.transfers < b.transfers;
  if (a.station !== b.station) return a.station < b.station;
  return a.line < b.line;
}

/**
 * The quickest journey from origin to destination.
 *
 * Riding time is the sum of segment minutes. Every change of line costs
 * `transferMinutes`; boarding the first line is free. Among equally quick
 * journeys, the one with fewer transfers wins. Returns a Journey with no legs
 * when origin === destination, or null when the destination cannot be reached.
 *
 * Dijkstra's algorithm over (station, line) states with a binary heap. An
 * improved state is pushed again instead of updated in place, and the stale
 * copy is skipped when it surfaces (lazy deletion). The heap uses the same
 * order as the old linear scan, so ties resolve identically.
 */
function fastestJourney(network, origin, destination, transferMinutes = DEFAULT_TRANSFER_MINUTES) {
  network.station(origin);
  network.station(destination);
  if (origin === destination) return new Journey(origin, destination, [], transferMinutes);

  const start = { key: stateKey(origin, NOT_BOARDED), station: origin, line: NOT_BOARDED, minutes: 0, transfers: 0, previous: null, via: null };
  const best = new Map([[start.key, start]]); // key -> best known state
  const settled = new Set();
  const queue = new MinHeap(comesBefore);
  queue.push(start);
  while (queue.size) {
    const current = queue.pop();
    if (settled.has(current.key)) continue; // stale: this state was settled more cheaply
    settled.add(current.key);
    if (current.station === destination) return buildJourney(origin, destination, current, transferMinutes);

    for (const connection of network.connectionsFrom(current.station)) {
      const key = stateKey(connection.to, connection.line);
      if (settled.has(key)) continue;
      const changes = current.line !== NOT_BOARDED && connection.line !== current.line;
      const minutes = current.minutes + connection.minutes + (changes ? transferMinutes : 0);
      const transfers = current.transfers + (changes ? 1 : 0);
      const known = best.get(key);
      if (known && (known.minutes < minutes || (known.minutes === minutes && known.transfers <= transfers))) continue;
      const state = { key, station: connection.to, line: connection.line, minutes, transfers, previous: current, via: connection };
      best.set(key, state);
      queue.push(state);
    }
  }
  return null;
}

/** Walk the parent pointers back and group consecutive hops by line. */
function buildJourney(origin, destination, state, transferMinutes) {
  const hops = [];
  for (let at = state; at.previous; at = at.previous) hops.push({ from: at.previous.station, connection: at.via });
  hops.reverse();

  const legs = [];
  let current = null;
  for (const { from, connection } of hops) {
    if (!current || current.line !== connection.line) {
      if (current) legs.push(new Leg(current.line, current.stations, current.minutes));
      current = { line: connection.line, stations: [from], minutes: 0 };
    }
    current.stations.push(connection.to);
    current.minutes += connection.minutes;
  }
  legs.push(new Leg(current.line, current.stations, current.minutes));
  return new Journey(origin, destination, legs, transferMinutes);
}

module.exports = { fewestStops, fastestJourney };
