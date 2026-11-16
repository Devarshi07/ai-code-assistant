// Prints the solver's routes for the sample levels.
import { collectAllGems, solve } from './src/solver.ts';
import { loadSamples } from './src/levels.ts';
import { render, summary } from './src/render.ts';

function main(): void {
  for (const level of loadSamples()) {
    const run = solve(level);
    console.log(summary(level, run));
    console.log(render(level, run ? run.path : []));
    if (level.gems.length) {
      try {
        const gemRun = collectAllGems(level);
        console.log(`  gem run: ${gemRun ? gemRun.moves : 'impossible'} moves`);
      } catch (error) {
        console.log(`  gem run: ${(error as Error).message}`);
      }
    }
    console.log('');
  }
}

main();
