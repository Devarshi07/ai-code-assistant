// Prints the solver's routes for the sample levels.
const { solve, collectAllGems } = require('./src/solver');
const { loadSamples } = require('./src/levels');
const { render, summary } = require('./src/render');

function main() {
  for (const level of loadSamples()) {
    const run = solve(level);
    console.log(summary(level, run));
    console.log(render(level, run ? run.path : []));
    if (level.gems.length) {
      try {
        const gemRun = collectAllGems(level);
        console.log(`  gem run: ${gemRun ? gemRun.moves : 'impossible'} moves`);
      } catch (error) {
        console.log(`  gem run: ${error.message}`);
      }
    }
    console.log('');
  }
}

if (require.main === module) main();
