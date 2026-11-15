// Plain data models shared by the timetable loader, the network and the planner.
//
// Station and line names are case-sensitive strings exactly as they appear in
// the timetable ("Old Town", "Red"). Running times are whole minutes.

/** Minutes a rider needs to change lines at a station (walk, wait, board). */
const DEFAULT_TRANSFER_MINUTES = 5;

/**
 * A directed edge in the network: from some station, ride `line` to `to`.
 * @typedef {{ to: string, line: string, minutes: number }} Connection
 */

class Station {
  constructor(name) {
    this.name = name;
    this.lines = []; // lines calling here, in load order
  }

  addLine(lineName) {
    if (!this.lines.includes(lineName)) this.lines.push(lineName);
  }
}

/**
 * A transit line as written in the timetable.
 *
 * `minutes[i]` is the running time between `stations[i]` and
 * `stations[i + 1]`. Trains run in both directions unless `oneWay` is set.
 */
class Line {
  constructor(name, stations, minutes, oneWay = false) {
    if (stations.length < 2) throw new Error(`line ${name} needs at least two stations`);
    if (minutes.length !== stations.length - 1) throw new Error(`line ${name} needs one running time per pair of stops`);
    this.name = name;
    this.stations = stations;
    this.minutes = minutes;
    this.oneWay = oneWay;
  }

  /** Yield each hop between consecutive stops, in timetable order. */
  *segments() {
    for (let i = 0; i < this.minutes.length; i++) {
      yield { origin: this.stations[i], destination: this.stations[i + 1], minutes: this.minutes[i] };
    }
  }

  /** Minutes from the first stop to the last. */
  get runningTime() {
    return this.minutes.reduce((sum, minutes) => sum + minutes, 0);
  }
}

/**
 * A continuous ride on one line.
 *
 * `stations` runs from the boarding station to the alighting station
 * inclusive; `minutes` is the riding time of this leg only.
 */
class Leg {
  constructor(line, stations, minutes) {
    this.line = line;
    this.stations = stations;
    this.minutes = minutes;
  }

  get origin() {
    return this.stations[0];
  }

  get destination() {
    return this.stations[this.stations.length - 1];
  }

  get stops() {
    return this.stations.length - 1;
  }
}

/** A planned trip: legs in travel order and the transfer penalty used to plan it. */
class Journey {
  constructor(origin, destination, legs = [], transferMinutes = DEFAULT_TRANSFER_MINUTES) {
    this.origin = origin;
    this.destination = destination;
    this.legs = legs;
    this.transferMinutes = transferMinutes;
  }

  get transfers() {
    return Math.max(this.legs.length - 1, 0);
  }

  get ridingMinutes() {
    return this.legs.reduce((sum, leg) => sum + leg.minutes, 0);
  }

  get totalMinutes() {
    return this.ridingMinutes + this.transfers * this.transferMinutes;
  }
}

module.exports = { DEFAULT_TRANSFER_MINUTES, Station, Line, Leg, Journey };
