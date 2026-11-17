// Prints the critical path and runner plans for the sample pipelines.
import { loadPipeline } from './src/graph.ts';
import { SAMPLES } from './src/samples.ts';
import { schedule, serialSchedule } from './src/scheduler.ts';
import { renderGantt } from './src/timeline.ts';

const RUNNERS = 3;

function main(): void {
  for (const [name, text] of Object.entries(SAMPLES)) {
    const graph = loadPipeline(text);
    const { minutes, path } = graph.criticalPath();
    console.log(`== ${name}: ${graph.size} tasks ==`);
    console.log(`critical path: ${path.join(' -> ')} (${minutes} min)`);
    console.log("\nserial plan (one runner, today's behaviour):");
    console.log(renderGantt(serialSchedule(graph), { graph }));
    console.log(`\nparallel plan (${RUNNERS} runners):`);
    try {
      console.log(renderGantt(schedule(graph, RUNNERS), { graph }));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Not implemented')) throw error;
      console.log(`  ${error.message}`);
    }
    console.log('');
  }
}

main();
