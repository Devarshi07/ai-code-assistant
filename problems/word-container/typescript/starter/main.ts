// Demo: import the bundled lists, then show the stats panel, autocomplete and pattern search.
import { WordContainer } from './src/container.ts';
import { loadBundled } from './src/loader.ts';
import { formatMatches, formatPrefix, formatStoreReport } from './src/report.ts';

const AUTOCOMPLETE = ['bowl', 'squ', 'ten'];
const RETIRED = ['squash', 'tennis']; // flagged by the editors as overused
const SEARCHES: [string, number | null][] = [['c?t', null], ['?a?e', 8], ['b??l', null], ['*ing', null], ['*ball', null], ['c*e', 6]];

function main(): void {
  const words = new WordContainer();
  console.log('Import');
  for (const report of loadBundled(words)) {
    console.log(`  ${report.summary()}`);
    for (const { line, reason } of report.rejected) console.log(`    line ${line}: ${reason}`);
  }
  console.log('');
  console.log(formatStoreReport(words));
  console.log('');

  console.log('Autocomplete');
  for (const prefix of AUTOCOMPLETE) console.log(`  ${formatPrefix(words, prefix)}`);
  for (const word of RETIRED) words.remove(word);
  console.log(`  retired ${RETIRED.join(', ')}; ${words.size} words left`);
  for (const prefix of AUTOCOMPLETE) console.log(`  ${formatPrefix(words, prefix)}`);
  console.log('');

  console.log('Pattern search');
  for (const [pattern, limit] of SEARCHES) {
    let found: string[];
    try {
      found = words.match(pattern, limit);
    } catch (error) {
      console.log(`  ${pattern}  ${(error as Error).message}`);
      break;
    }
    console.log(`  ${formatMatches(pattern, found, limit)}`);
  }
}

main();
