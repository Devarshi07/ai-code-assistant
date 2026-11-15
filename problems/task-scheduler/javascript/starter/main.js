// Prints the critical path and runner plans for the sample pipelines.
const { loadPipeline } = require('./src/graph');
const { schedule, serialSchedule } = require('./src/scheduler');
const { renderGantt } = require('./src/timeline');
const { SAMPLES } = require('./src/samples');

const RUNNERS = 3;

function main() {
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
      if (!error.message.startsWith('Not implemented')) throw error;
      console.log(`  ${error.message}`);
    }
    console.log('');
  }
}

if (require.main === module) main();
