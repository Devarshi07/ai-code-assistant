// Human-readable output for the rider app and the command line.
import type { Journey } from './models.ts';
import type { Network } from './network.ts';

function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

/** 'Airport -> Central -> Harbor (2 stops)' for a fewest-stops route. */
export function formatStops(route: string[] | null): string {
  if (!route) return 'no route';
  return `${route.join(' -> ')} (${plural(route.length - 1, 'stop')})`;
}

/**
 * One-sentence itinerary, as shown in the journey card.
 *
 * Take Red from Airport to Central (4 min), transfer (5 min), take Blue
 * from Central to Museum (7 min). Total 16 min, 1 transfer.
 */
export function formatJourney(journey: Journey | null): string {
  if (!journey) return 'No journey found.';
  if (!journey.legs.length) return `You are already at ${journey.origin}.`;
  const parts: string[] = [];
  journey.legs.forEach((leg, index) => {
    if (index) parts.push(`transfer (${journey.transferMinutes} min)`);
    const verb = index ? 'take' : 'Take';
    parts.push(`${verb} ${leg.line} from ${leg.origin} to ${leg.destination} (${leg.minutes} min)`);
  });
  return `${parts.join(', ')}. Total ${journey.totalMinutes} min, ${plural(journey.transfers, 'transfer')}.`;
}

/** Multi-line itinerary with one row per leg, for the detail view. */
export function formatItinerary(journey: Journey | null): string {
  if (!journey || !journey.legs.length) return formatJourney(journey);
  const width = Math.max(...journey.legs.map(leg => leg.line.length));
  const pad = ''.padEnd(width);
  const rows: string[] = [];
  journey.legs.forEach((leg, index) => {
    if (index) rows.push(`  ${pad}  change at ${leg.origin} (${journey.transferMinutes} min)`);
    rows.push(`  ${leg.line.padEnd(width)}  ${leg.origin} -> ${leg.destination}  ${leg.minutes} min, ${plural(leg.stops, 'stop')}`);
  });
  rows.push(`  ${pad}  arrive after ${journey.totalMinutes} min`);
  return rows.join('\n');
}

/** A short summary of every line, in timetable order. */
export function describeNetwork(network: Network): string {
  const rows = [`${network.name}: ${network.stations.size} stations, ${network.lines.size} lines`];
  const width = Math.max(0, ...[...network.lines.keys()].map(name => name.length));
  for (const line of network.lines.values()) {
    const first = line.stations[0];
    const last = line.stations[line.stations.length - 1];
    const route = first === last ? `${first} (loop)` : `${first} - ${last}`;
    const direction = line.oneWay ? 'one-way' : 'two-way';
    rows.push(`  ${line.name.padEnd(width)}  ${route}  (${plural(line.stations.length, 'station')}, ${line.runningTime} min, ${direction})`);
  }
  return rows.join('\n');
}
