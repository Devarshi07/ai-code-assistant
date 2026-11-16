// A quick syntax check after the agent edits a file, so a broken edit is
// reported back to it at once instead of surfacing later as a failing test.
// JavaScript uses this Node.js, Python uses a local Python if there is one,
// JSON is parsed directly; other files are not checked.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const execute = (command, args, timeout = 8000) => new Promise(resolve => {
  execFile(command, args, {timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 1024 * 1024}, (error, stdout, stderr) => resolve({ok: !error, code: error?.code, output: `${stdout || ''}${stderr || ''}`}));
});

let python;
async function findPython() {
  if (python !== undefined) return python;
  python = null;
  for (const candidate of ['python3', 'python', 'py']) {
    const result = await execute(candidate, ['-c', 'import ast; print("ok")'], 5000);
    if (result.ok && result.output.includes('ok')) { python = candidate; break; }
  }
  return python;
}

const firstUseful = text => String(text).split('\n').map(l => l.trim()).filter(Boolean).filter(l => !/^at |^Node\.js v|^\^+$|internal\//.test(l)).slice(-2).join(' ').slice(0, 300);

// Returns null when the file type isn't checked, otherwise {ok, message}.
export async function checkSyntax(file, content) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') {
    try { JSON.parse(content); return {ok: true}; } catch (error) { return {ok: false, message: error.message}; }
  }
  if (!['.js', '.mjs', '.cjs', '.py'].includes(ext)) return null;
  const command = ext === '.py' ? await findPython() : process.execPath;
  if (!command) return null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-syntax-'));
  const target = path.join(dir, `check-${randomUUID().slice(0, 8)}${ext}`);
  try {
    await fs.writeFile(target, content);
    const result = ext === '.py'
      ? await execute(command, ['-c', 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read(), sys.argv[1])', target])
      : await execute(command, ['--check', target]);
    if (result.ok) return {ok: true};
    return {ok: false, message: firstUseful(result.output.split(target).join(file)) || 'The file does not parse.'};
  } finally { await fs.rm(dir, {recursive: true, force: true}).catch(() => {}); }
}
