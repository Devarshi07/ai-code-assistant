// Plain data models shared by the timetable loader, the network and the planner.
//
// Station and line names are case-sensitive strings exactly as they appear in
// the timetable ("Old Town", "Red"). Running times are whole minutes.

/** Minutes a rider needs to change lines at a station (walk, wait, board). */
export const DEFAULT_TRANSFER_MINUTES = 5;

/** A directed edge in the network: from some station, ride `line` to `to`. */
export interface Connection {
  readonly to: string;
  readonly line: string;
  readonly minutes: number;
}

/** One hop of a line between two consecutive stops, in timetable order. */
export interface Segment {
  readonly origin: string;
  readonly destination: string;
  readonly minutes: number;
}

export class Station {
  readonly name: string;
  readonly lines: string[] = []; // lines calling here, in load order

  constructor(name: string) {
    this.name = name;
  }

  addLine(lineName: string): void {
    if (!this.lines.includes(lineName)) this.lines.push(lineName);
  }
}

/**
 * A transit line as written in the timetable.
 *
 * `minutes[i]` is the running time between `stations[i]` and
 * `stations[i + 1]`. Trains run in both directions unless `oneWay` is set.
 */
export class Line {
  readonly name: string;
  readonly stations: string[];
  readonly minutes: number[];
  readonly oneWay: boolean;

  constructor(name: string, stations: string[], minutes: number[], oneWay = false) {
    if (stations.length < 2) throw new Error(`line ${name} needs at least two stations`);
    if (minutes.length !== stations.length - 1) throw new Error(`line ${name} needs one running time per pair of stops`);
    this.name = name;
    this.stations = stations;
    this.minutes = minutes;
    this.oneWay = oneWay;
  }

  /** Yield each hop between consecutive stops, in timetable order. */
  *segments(): Generator<Segment> {
    for (let i = 0; i < this.minutes.length; i++) {
      yield { origin: this.stations[i], destination: this.stations[i + 1], minutes: this.minutes[i] };
    }
  }

  /** Minutes from the first stop to the last. */
  get runningTime(): number {
    return this.minutes.reduce((sum, minutes) => sum + minutes, 0);
  }
}

/**
 * A continuous ride on one line.
 *
 * `stations` runs from the boarding station to the alighting station
 * inclusive; `minutes` is the riding time of this leg only.
 */
export class Leg {
  readonly line: string;
  readonly stations: string[];
  readonly minutes: number;

  constructor(line: string, stations: string[], minutes: number) {
    this.line = line;
    this.stations = stations;
    this.minutes = minutes;
  }

  get origin(): string {
    return this.stations[0];
  }

  get destination(): string {
    return this.stations[this.stations.length - 1];
  }

  get stops(): number {
    return this.stations.length - 1;
  }
}

/** A planned trip: legs in travel order and the transfer penalty used to plan it. */
export class Journey {
  readonly origin: string;
  readonly destination: string;
  readonly legs: Leg[];
  readonly transferMinutes: number;

  constructor(origin: string, destination: string, legs: Leg[] = [], transferMinutes = DEFAULT_TRANSFER_MINUTES) {
    this.origin = origin;
    this.destination = destination;
    this.legs = legs;
    this.transferMinutes = transferMinutes;
  }

  get transfers(): number {
    return Math.max(this.legs.length - 1, 0);
  }

  get ridingMinutes(): number {
    return this.legs.reduce((sum, leg) => sum + leg.minutes, 0);
  }

  get totalMinutes(): number {
    return this.ridingMinutes + this.transfers * this.transferMinutes;
  }
}
