// The transit network: stations, lines and the directed connections between them.
import { Station } from './models.ts';
import type { Connection, Line } from './models.ts';

/** Thrown when a query names a station that is not in the network. */
export class UnknownStationError extends Error {
  readonly station: string;

  constructor(name: string) {
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
export class Network {
  readonly name: string;
  readonly stations = new Map<string, Station>(); // station name -> Station
  readonly lines = new Map<string, Line>(); // line name -> Line
  private readonly connections = new Map<string, Connection[]>(); // station name -> connections leaving it

  constructor(name = 'network') {
    this.name = name;
  }

  addLine(line: Line): void {
    if (this.lines.has(line.name)) throw new Error(`duplicate line '${line.name}'`);
    this.lines.set(line.name, line);
    for (const name of line.stations) this.ensureStation(name).addLine(line.name);

    const segments = line.segments();
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

  private ensureStation(name: string): Station {
    let station = this.stations.get(name);
    if (!station) {
      station = new Station(name);
      this.stations.set(name, station);
      this.connections.set(name, []);
    }
    return station;
  }

  private connect(origin: string, connection: Connection): void {
    this.connections.get(origin)!.push(connection);
  }

  /** Look up a station by name, throwing UnknownStationError if it does not exist. */
  station(name: string): Station {
    const station = this.stations.get(name);
    if (!station) throw new UnknownStationError(name);
    return station;
  }

  /**
   * Every connection leaving the named station, across all lines.
   * The array is shared with the network; treat it as read-only.
   */
  connectionsFrom(name: string): readonly Connection[] {
    this.station(name);
    return this.connections.get(name)!;
  }

  /** Names of the stations one hop away, sorted. */
  neighbours(name: string): string[] {
    return [...new Set(this.connectionsFrom(name).map(connection => connection.to))].sort();
  }

  linesAt(name: string): string[] {
    return [...this.station(name).lines];
  }

  has(name: string): boolean {
    return this.stations.has(name);
  }

  get size(): number {
    return this.stations.size;
  }

  toString(): string {
    return `Network(${this.name}, ${this.stations.size} stations, ${this.lines.size} lines)`;
  }
}
