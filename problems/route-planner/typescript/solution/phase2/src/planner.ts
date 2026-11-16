// Journey planning over a Network.
import { DEFAULT_TRANSFER_MINUTES, Journey, Leg } from './models.ts';
import type { Connection } from './models.ts';
import type { Network } from './network.ts';

// The line of the starting state: the rider has not boarded anything yet.
const NOT_BOARDED = '';

/** One search state: standing at `station`, having arrived on `line`. */
interface State {
  key: string;
  station: string;
  line: string;
  minutes: number;
  transfers: number;
  previous: State | null;
  via: Connection | null; // the connection ridden to get here
}

/**
 * Breadth-first search for the route with the fewest stops, ignoring lines.
 *
 * Powers the "quick route" panel in the rider app. Returns the station names
 * from origin to destination inclusive, or null when there is no route.
 * Unknown station names throw UnknownStationError.
 */
export function fewestStops(network: Network, origin: string, destination: string): string[] | null {
  network.station(origin);
  network.station(destination);
  if (origin === destination) return [origin];
  const cameFrom = new Map<string, string | null>([[origin, null]]);
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

function walkBack(cameFrom: Map<string, string | null>, station: string): string[] {
  const route = [station];
  for (let previous = cameFrom.get(station); previous != null; previous = cameFrom.get(previous)) {
    route.push(previous);
  }
  return route.reverse();
}

/** Map key for a (station, line) search state. Newlines never appear in names. */
function stateKey(station: string, line: string): string {
  return `${station}\n${line}`;
}

/** Search order: fewer minutes, then fewer transfers, then station and line name. */
function comesBefore(a: State, b: State): boolean {
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
 * Dijkstra's algorithm over (station, line) states: the cost of the next hop
 * depends on the line the rider is already on.
 */
export function fastestJourney(
  network: Network,
  origin: string,
  destination: string,
  transferMinutes: number = DEFAULT_TRANSFER_MINUTES,
): Journey | null {
  network.station(origin);
  network.station(destination);
  if (origin === destination) return new Journey(origin, destination, [], transferMinutes);

  const start: State = { key: stateKey(origin, NOT_BOARDED), station: origin, line: NOT_BOARDED, minutes: 0, transfers: 0, previous: null, via: null };
  const states = new Map<string, State>([[start.key, start]]); // key -> best known state
  const settled = new Set<string>();
  for (;;) {
    // Pick the cheapest state that is not settled yet.
    let current: State | null = null;
    for (const state of states.values()) {
      if (settled.has(state.key)) continue;
      if (current === null || comesBefore(state, current)) current = state;
    }
    if (current === null) return null;
    settled.add(current.key);
    if (current.station === destination) return buildJourney(origin, destination, current, transferMinutes);

    for (const connection of network.connectionsFrom(current.station)) {
      const key = stateKey(connection.to, connection.line);
      if (settled.has(key)) continue;
      const changes = current.line !== NOT_BOARDED && connection.line !== current.line;
      const minutes = current.minutes + connection.minutes + (changes ? transferMinutes : 0);
      const transfers = current.transfers + (changes ? 1 : 0);
      const known = states.get(key);
      if (known && (known.minutes < minutes || (known.minutes === minutes && known.transfers <= transfers))) continue;
      states.set(key, { key, station: connection.to, line: connection.line, minutes, transfers, previous: current, via: connection });
    }
  }
}

/** Walk the parent pointers back and group consecutive hops by line. */
function buildJourney(origin: string, destination: string, state: State, transferMinutes: number): Journey {
  const hops: { from: string; connection: Connection }[] = [];
  for (let at = state; at.previous; at = at.previous) hops.push({ from: at.previous.station, connection: at.via! });
  hops.reverse();

  const legs: Leg[] = [];
  let current: { line: string; stations: string[]; minutes: number } | null = null;
  for (const { from, connection } of hops) {
    if (!current || current.line !== connection.line) {
      if (current) legs.push(new Leg(current.line, current.stations, current.minutes));
      current = { line: connection.line, stations: [from], minutes: 0 };
    }
    current.stations.push(connection.to);
    current.minutes += connection.minutes;
  }
  legs.push(new Leg(current!.line, current!.stations, current!.minutes));
  return new Journey(origin, destination, legs, transferMinutes);
}
