// Prints the planner's answers for a few common Harbour City trips.
const { fewestStops, fastestJourney } = require('./src/planner');
const { describeNetwork, formatItinerary, formatStops } = require('./src/format');
const { loadHarbourCity } = require('./src/samples');

const TRIPS = [
  ['Airport', 'Museum'],
  ['Museum', 'Airport'],
  ['Airport', 'Science Park'],
  ['Old Town', 'Island Pier'],
  ['Lighthouse', 'City Hall'],
];

function main() {
  const network = loadHarbourCity();
  console.log(describeNetwork(network));

  console.log('\nQuick routes (fewest stops)');
  for (const [origin, destination] of TRIPS) {
    console.log(`  ${origin} to ${destination}: ${formatStops(fewestStops(network, origin, destination))}`);
  }

  console.log('\nFastest journeys (5 min to change lines)');
  for (const [origin, destination] of TRIPS) {
    console.log(`${origin} to ${destination}`);
    let journey;
    try {
      journey = fastestJourney(network, origin, destination);
    } catch (error) {
      console.log(`  ${error.message}`);
      break;
    }
    console.log(journey ? formatItinerary(journey) : '  no journey');
  }
}

if (require.main === module) main();
