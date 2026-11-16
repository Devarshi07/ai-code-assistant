// Loads a Network from the plain-text timetable format used by the scheduling team.
//
//     # Harbour City weekday service
//     line Red: Airport 4 Central 3 Harbor 6 Museum
//     line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse
//
// Each entry lists the stations of one line, separated by the running time in
// minutes to the next stop. Station names may contain spaces but must not be
// plain numbers. Lines run both ways unless the name is followed by `oneway`.
// Everything after a `#` is a comment.
import { Line } from './models.ts';
import { Network } from './network.ts';

export const ONE_WAY_FLAG = 'oneway';

/** A malformed timetable entry, reported with its line number. */
export class TimetableError extends Error {
  readonly lineNumber: number;

  constructor(lineNumber: number, message: string) {
    super(`line ${lineNumber}: ${message}`);
    this.name = 'TimetableError';
    this.lineNumber = lineNumber;
  }
}

/** Parse one `line <name> [oneway]: <stops>` entry into a Line. */
export function parseEntry(text: string, lineNumber = 1): Line {
  const colon = text.indexOf(':');
  let words = (colon < 0 ? text : text.slice(0, colon)).split(/\s+/).filter(Boolean);
  if (colon < 0 || !words.length || words[0] !== 'line') {
    throw new TimetableError(lineNumber, "expected 'line <name>: <stations>'");
  }
  words = words.slice(1);
  const oneWay = words.length > 0 && words[words.length - 1] === ONE_WAY_FLAG;
  if (oneWay) words = words.slice(0, -1);
  if (!words.length) throw new TimetableError(lineNumber, 'the line has no name');
  const { stations, minutes } = parseStops(text.slice(colon + 1), lineNumber);
  return new Line(words.join(' '), stations, minutes, oneWay);
}

function parseStops(body: string, lineNumber: number): { stations: string[]; minutes: number[] } {
  const stations: string[] = [];
  const minutes: number[] = [];
  let name: string[] = [];
  for (const token of body.split(/\s+/).filter(Boolean)) {
    if (!/^\d+$/.test(token)) {
      name.push(token);
      continue;
    }
    if (!name.length) throw new TimetableError(lineNumber, `running time ${token} must follow a station name`);
    if (Number(token) < 1) throw new TimetableError(lineNumber, 'running times must be at least 1 minute');
    stations.push(name.join(' '));
    minutes.push(Number(token));
    name = [];
  }
  if (!name.length) throw new TimetableError(lineNumber, 'a line must end with a station name');
  stations.push(name.join(' '));
  if (stations.length < 2) throw new TimetableError(lineNumber, 'a line needs at least two stations');
  return { stations, minutes };
}

/** Build a Network from timetable text. */
export function loadNetwork(text: string, name = 'network'): Network {
  const network = new Network(name);
  text.split(/\r?\n/).forEach((raw, index) => {
    const content = raw.split('#')[0].trim();
    if (!content) return;
    const line = parseEntry(content, index + 1);
    if (network.lines.has(line.name)) throw new TimetableError(index + 1, `duplicate line '${line.name}'`);
    network.addLine(line);
  });
  return network;
}
