// A node:test reporter for guided projects that run in Docker (Express API
// projects and TypeScript problems). It prints each result as one line
// prefixed with MARK, in the same shape as pyrunner.py, so the server parses
// Node, Python and Java runs the same way.
import path from 'node:path';

const MARK = '@@DGRESULT@@';
const line = record => `\n${MARK}${JSON.stringify(record)}\n`;

export default async function* reporter(source) {
  const started = Date.now();
  let passed = 0, failed = 0;
  // What each test file wrote to stderr: a file that fails to load (a syntax
  // error, a bad import) reports only "test failed", and the reason is here.
  const stderr = new Map();
  for await (const event of source) {
    const data = event.data || {};
    if (event.type === 'test:stdout' || event.type === 'test:stderr') {
      // stderr events name the file relative to the working directory; results name it absolute.
      if (event.type === 'test:stderr' && data.file) { const key = path.resolve(data.file); stderr.set(key, ((stderr.get(key) || '') + data.message).slice(0, 12000)); }
      yield data.message;
      continue;
    }
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    // describe() blocks report too; their tests are reported on their own.
    if (data.details?.type === 'suite') continue;
    const file = data.file ? path.relative(process.cwd(), data.file).split(path.sep).join('/') : '';
    const error = data.details?.error;
    const cause = error?.cause ?? error;
    const status = data.skip || data.todo ? 'skip' : event.type === 'test:pass' ? 'pass' : cause?.code === 'ERR_ASSERTION' || cause?.name === 'AssertionError' ? 'fail' : 'error';
    if (status === 'pass') passed++; else if (status !== 'skip') failed++;
    const wholeFile = data.file && (data.name === data.file || data.name === file || path.resolve(String(data.name)) === data.file);
    let message = String(cause?.message || error?.message || 'Test failed');
    if (wholeFile && status !== 'pass') {
      // Keep the location, the source line and the error; drop Node's internal frames.
      const root = `file://${process.cwd()}/`;
      const reason = (stderr.get(path.resolve(data.file)) || '').split('\n')
        .filter(l => l.trim() && !/^\s*at /.test(l) && !/^node:internal|triggerUncaughtException|ExperimentalWarning|--trace-warnings|^\s*\^+\s*$|^\s*[{}]\s*$|^\s*code: /.test(l))
        .map(l => l.split(root).join('').split(`${process.cwd()}/`).join('')).slice(0, 8).join('\n').trim();
      if (reason) message = `The file could not run:\n${reason}`;
    }
    yield line({type: 'test', file, name: wholeFile ? 'The file could not run' : data.name, status, ms: Math.round(data.details?.duration_ms || 0),
      ...(status === 'fail' || status === 'error' ? {message: message.slice(0, 2000), stack: wholeFile ? '' : String(cause?.stack || '').split('\n').slice(1, 8).join('\n')} : {})});
  }
  yield line({type: 'done', mode: 'tests', passed, failed, exitCode: failed ? 1 : 0, ms: Date.now() - started});
}
