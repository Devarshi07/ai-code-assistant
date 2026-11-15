// Runs a JavaScript practice project with the same runner the browser uses.
// Usage: node scripts/run-js.mjs <project-dir> tests <file...> | main <file>
import {readTree} from '../problems.mjs';
import {runProject} from '../dist/runner-core.js';

const [dir, mode, ...rest] = process.argv.slice(2);
const files = await readTree(dir);
const output = [];
const result = await runProject({files, mode, testFiles: mode === 'tests' ? rest : [], main: rest[0] || 'main.js'}, event => {
  if (event.type === 'log') output.push(event.text);
});
process.stdout.write(JSON.stringify({...result, output: output.join('').slice(-20000)}));
process.exit(0);
