// Prints the planner's answers for a few common Harbour City trips.
import { describeNetwork, formatItinerary, formatStops } from './src/format.ts';
import type { Journey } from './src/models.ts';
import { fastestJourney, fewestStops } from './src/planner.ts';
import { loadHarbourCity } from './src/samples.ts';

const TRIPS: [string, string][] = [
  ['Airport', 'Museum'],
  ['Museum', 'Airport'],
  ['Airport', 'Science Park'],
  ['Old Town', 'Island Pier'],
  ['Lighthouse', 'City Hall'],
];

function main(): void {
  const network = loadHarbourCity();
  console.log(describeNetwork(network));

  console.log('\nQuick routes (fewest stops)');
  for (const [origin, destination] of TRIPS) {
    console.log(`  ${origin} to ${destination}: ${formatStops(fewestStops(network, origin, destination))}`);
  }

  console.log('\nFastest journeys (5 min to change lines)');
  for (const [origin, destination] of TRIPS) {
    console.log(`${origin} to ${destination}`);
    let journey: Journey | null;
    try {
      journey = fastestJourney(network, origin, destination);
    } catch (error) {
      console.log(`  ${(error as Error).message}`);
      break;
    }
    console.log(journey ? formatItinerary(journey) : '  no journey');
  }
}

main();
