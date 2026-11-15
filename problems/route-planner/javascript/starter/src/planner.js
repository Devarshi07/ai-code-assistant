// Journey planning over a Network.
const { DEFAULT_TRANSFER_MINUTES } = require('./models');

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

/**
 * The quickest journey from origin to destination.
 *
 * Riding time is the sum of segment minutes. Every change of line costs
 * `transferMinutes`; boarding the first line is free. Among equally quick
 * journeys, the one with fewer transfers wins. Returns a Journey with no legs
 * when origin === destination, or null when the destination cannot be reached.
 */
function fastestJourney(network, origin, destination, transferMinutes = DEFAULT_TRANSFER_MINUTES) {
  throw new Error('Not implemented: fastestJourney (Phase 2)');
}

module.exports = { fewestStops, fastestJourney };
