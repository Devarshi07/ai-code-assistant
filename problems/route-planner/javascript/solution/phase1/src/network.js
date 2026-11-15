// The transit network: stations, lines and the directed connections between them.
const { Station } = require('./models');

/** Thrown when a query names a station that is not in the network. */
class UnknownStationError extends Error {
  constructor(name) {
    super(`unknown station: '${name}'`);
    this.name = 'UnknownStationError';
    this.station = name;
  }
}

/**
 * Stations and lines loaded from a timetable.
 *
 * Connections are directed: a two-way line contributes one connection in
 * each direction for every segment, a one-way line only the timetable
 * direction.
 */
class Network {
  constructor(name = 'network') {
    this.name = name;
    this.stations = new Map(); // station name -> Station
    this.lines = new Map(); // line name -> Line
    this.connections = new Map(); // station name -> [Connection, ...]
  }

  addLine(line) {
    if (this.lines.has(line.name)) throw new Error(`duplicate line '${line.name}'`);
    this.lines.set(line.name, line);
    for (const name of line.stations) this.ensureStation(name).addLine(line.name);

    // segments() is a generator, so materialise it: both loops need every hop.
    const segments = [...line.segments()];
    for (const segment of segments) {
      this.connect(segment.origin, { to: segment.destination, line: line.name, minutes: segment.minutes });
    }
    if (!line.oneWay) {
      // Trains run back along the same track, with the same running times.
      for (const segment of segments) {
        this.connect(segment.destination, { to: segment.origin, line: line.name, minutes: segment.minutes });
      }
    }
  }

  ensureStation(name) {
    if (!this.stations.has(name)) {
      this.stations.set(name, new Station(name));
      this.connections.set(name, []);
    }
    return this.stations.get(name);
  }

  connect(origin, connection) {
    this.connections.get(origin).push(connection);
  }

  /** Look up a station by name, throwing UnknownStationError if it does not exist. */
  station(name) {
    const station = this.stations.get(name);
    if (!station) throw new UnknownStationError(name);
    return station;
  }

  /**
   * Every connection leaving the named station, across all lines.
   * The array is shared with the network; treat it as read-only.
   */
  connectionsFrom(name) {
    this.station(name);
    return this.connections.get(name);
  }

  /** Names of the stations one hop away, sorted. */
  neighbours(name) {
    return [...new Set(this.connectionsFrom(name).map(connection => connection.to))].sort();
  }

  linesAt(name) {
    return [...this.station(name).lines];
  }

  has(name) {
    return this.stations.has(name);
  }

  get size() {
    return this.stations.size;
  }

  toString() {
    return `Network(${this.name}, ${this.stations.size} stations, ${this.lines.size} lines)`;
  }
}

module.exports = { Network, UnknownStationError };
