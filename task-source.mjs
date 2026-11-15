import fs from 'node:fs/promises';
import path from 'node:path';
import { randomInt } from 'node:crypto';
// Python tasks come from SWE-bench Verified; nine other languages from SWE-bench Multilingual.
// Both publish a prepared Docker image and an evaluation script for every task.
export const DATASETS = [
  {id: 'SWE-bench/SWE-bench_Multilingual', cache: 'multilingual.json'},
  {id: 'SWE-bench/SWE-bench_Verified', cache: 'verified.json'}
];
const languages = {'.py':'python','.java':'java','.go':'go','.rs':'rust','.rb':'ruby','.php':'php','.ts':'typescript','.tsx':'typescript','.js':'node','.jsx':'node','.c':'c','.h':'c','.cpp':'cpp','.cc':'cpp','.hpp':'cpp'};
export function sanitizeTask(row, dataset = DATASETS[0].id) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(row.repo) || !/^[a-f0-9]{40}$/.test(row.base_commit) || !/^swebench\/[a-z0-9_.:-]+$/.test(row.image)) throw new Error('Invalid benchmark task metadata.');
  const names = [...String(row.patch).matchAll(/^\+\+\+ b\/(.+)$/gm)].map(m=>m[1]);
  const counts={}; for(const name of names){const lang=languages[path.extname(name)];if(lang)counts[lang]=(counts[lang]||0)+1;}
  const language=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||'cpp';
  // Never cache or return the reference solution or hints.
  return {id:row.instance_id, repo:row.repo, commit:row.base_commit, image:row.image, brief:row.problem_statement, created:row.created_at, language, ...(row.difficulty?{difficulty:row.difficulty}:{}), evalScript:row.eval_script, expectedFailures:row.FAIL_TO_PASS, source:`https://huggingface.co/datasets/${dataset}`};
}
export function publicTask(task) { const {evalScript, ...safe}=task; return safe; }

async function fetchDataset(dataset) {
  const tasks = [];
  for (let offset = 0, total = Infinity; offset < total; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=default&split=test&offset=${offset}&length=100`;
    const res = await fetch(url, {signal: AbortSignal.timeout(60000)});
    if (!res.ok) throw new Error(`Task library unavailable (${res.status}). Try again later or import a GitHub URL.`);
    const data = await res.json();
    total = data.num_rows_total ?? 0;
    // Skip the rare row the API truncates rather than losing the whole library.
    for (const record of data.rows) if (!record.truncated_cells?.length) { try { tasks.push(sanitizeTask(record.row, dataset)); } catch {} }
    if (!data.rows.length) break;
  }
  if (!tasks.length) throw new Error('The task library returned no usable tasks.');
  return tasks;
}

let loading;
export async function loadTasks(cacheDir) {
  if (loading) return loading;
  loading = (async () => {
    await fs.mkdir(cacheDir, {recursive: true});
    const all = [], failures = [];
    for (const dataset of DATASETS) {
      const cache = path.join(cacheDir, dataset.cache);
      let stored = null;
      try { stored = JSON.parse(await fs.readFile(cache, 'utf8')); } catch {}
      if (stored && Date.now() - stored.saved < 7 * 86400000) { all.push(...stored.tasks); continue; }
      try {
        const tasks = await fetchDataset(dataset.id);
        await fs.writeFile(cache, JSON.stringify({saved: Date.now(), tasks}));
        all.push(...tasks);
      } catch (error) {
        // Fall back to an expired copy; only fail if nothing at all is available.
        if (stored) all.push(...stored.tasks); else failures.push(error);
      }
    }
    if (!all.length) throw failures[0] || new Error('Task library unavailable. Try again later or import a GitHub URL.');
    return all;
  })();
  try { return await loading; } finally { loading = undefined; }
}
export function chooseTask(tasks, seen, language='all', scope='all') {
  let pool=tasks.filter(t=>(language==='all'||t.language===language)&&(scope!=='legacy'||Number(t.created.slice(0,4))<=2020));
  if(!pool.length)throw new Error('No tasks match these filters. Choose another language or include all years.');
  let fresh=pool.filter(t=>!seen.includes(t.id));const recycled=!fresh.length;if(recycled)fresh=pool;
  return {task:fresh[randomInt(fresh.length)],recycled,total:pool.length};
}
