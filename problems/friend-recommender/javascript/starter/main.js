// Prints a support-desk view of the sample Campfire network.
const { loadSample } = require('./src/loader');
const { recommend } = require('./src/recommend');
const { friendList, networkSummary, profileCard, suggestionLines } = require('./src/report');

function main() {
  const graph = loadSample();
  console.log(`Campfire sample network: ${networkSummary(graph)}`);
  console.log('');
  for (const userId of ['alice', 'bob', 'judy', 'peggy']) console.log(friendList(graph, userId));
  console.log('');
  console.log(profileCard(graph, 'erin', 'alice'));
  console.log('');
  for (const userId of ['alice', 'frank', 'olivia']) {
    try {
      console.log(suggestionLines(graph, userId, recommend(graph, userId, 3)));
    } catch (error) {
      console.log(`People ${graph.user(userId).firstName} may know: ${error.message}`);
    }
  }
}

if (require.main === module) main();
