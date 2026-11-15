// Demo: import the bundled lists, then show the stats panel, autocomplete and pattern search.
const { WordContainer } = require('./src/container');
const { loadBundled } = require('./src/loader');
const { formatMatches, formatPrefix, formatStoreReport } = require('./src/report');

const AUTOCOMPLETE = ['bowl', 'squ', 'ten'];
const RETIRED = ['squash', 'tennis']; // flagged by the editors as overused
const SEARCHES = [['c?t', null], ['?a?e', 8], ['b??l', null], ['*ing', null], ['*ball', null], ['c*e', 6]];

function main() {
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
    let found;
    try {
      found = words.match(pattern, limit);
    } catch (error) {
      console.log(`  ${pattern}  ${error.message}`);
      break;
    }
    console.log(`  ${formatMatches(pattern, found, limit)}`);
  }
}

if (require.main === module) main();

module.exports = { main };
