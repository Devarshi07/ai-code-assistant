// Prints a support-desk view of the sample Campfire network.
import { loadSample } from './src/loader.ts';
import { recommend } from './src/recommend.ts';
import { friendList, networkSummary, profileCard, suggestionLines } from './src/report.ts';

function main(): void {
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
      console.log(`People ${graph.user(userId).firstName} may know: ${(error as Error).message}`);
    }
  }
}

main();
