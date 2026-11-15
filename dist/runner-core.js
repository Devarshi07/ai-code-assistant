// Runs a small CommonJS project with node:test / node:assert compatible shims.
// Used by the in-browser Web Worker (runner-worker.js) and by the Node.js
// problem validator, so both execute candidate code with identical semantics.

const LOG_LIMIT = 200000;

export class AssertionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AssertionError';
    this.code = 'ERR_ASSERTION';
    Object.assign(this, details);
  }
}

export function inspect(value, depth = 0, seen = new Set()) {
  if (typeof value === 'string') return depth ? JSON.stringify(value) : value;
  if (value === null || value === undefined || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value === 'bigint') return value + 'n';
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return value.prototype && /^class\b/.test(Function.prototype.toString.call(value)) ? `[class ${value.name || 'anonymous'}]` : `[Function: ${value.name || 'anonymous'}]`;
  if (seen.has(value)) return '[Circular]';
  if (depth > 4) return Array.isArray(value) ? '[Array]' : '[Object]';
  seen.add(value);
  try {
    const nested = item => inspect(item, depth + 1, seen);
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return String(value);
    if (Array.isArray(value)) {
      const shown = value.slice(0, 100).map(nested);
      if (value.length > 100) shown.push(`... ${value.length - 100} more items`);
      return `[ ${shown.join(', ')} ]`.replace('[  ]', '[]');
    }
    if (value instanceof Map) return `Map(${value.size}) { ${[...value].slice(0, 50).map(([k, v]) => `${nested(k)} => ${nested(v)}`).join(', ')} }`;
    if (value instanceof Set) return `Set(${value.size}) { ${[...value].slice(0, 50).map(nested).join(', ')} }`;
    const name = value.constructor && value.constructor !== Object ? value.constructor.name + ' ' : '';
    const keys = Object.keys(value);
    const body = keys.slice(0, 50).map(key => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${nested(value[key])}`);
    if (keys.length > 50) body.push(`... ${keys.length - 50} more`);
    return `${name}{ ${body.join(', ')} }`.replace('{  }', '{}');
  } finally { seen.delete(value); }
}

function format(args) {
  return args.map(arg => inspect(arg)).join(' ');
}

export function isDeepStrictEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.get(a) === b) return true;
  seen.set(a, b);
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return String(a) === String(b);
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) if (!b.has(key) || !isDeepStrictEqual(value, b.get(key), seen)) return false;
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    outer: for (const value of a) {
      if (b.has(value)) continue;
      if (typeof value === 'object' && value !== null) for (const other of b) if (isDeepStrictEqual(value, other, seen)) continue outer;
      return false;
    }
    return true;
  }
  if (Array.isArray(a) && a.length !== b.length) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) if (!Object.prototype.hasOwnProperty.call(b, key) || !isDeepStrictEqual(a[key], b[key], seen)) return false;
  return true;
}

function fail(message, fallback, details) {
  if (message instanceof Error) throw message;
  throw new AssertionError(message || fallback, details);
}

function errorMatches(error, expected) {
  if (expected === undefined) return true;
  if (expected instanceof RegExp) return expected.test(error?.message ?? String(error)) || expected.test(String(error));
  if (typeof expected === 'function') {
    if (expected === Error || (expected.prototype && expected.prototype instanceof Error)) return error instanceof expected;
    return expected(error) === true;
  }
  if (typeof expected === 'object' && expected !== null) {
    return Object.keys(expected).every(key => expected[key] instanceof RegExp && typeof error?.[key] === 'string' ? expected[key].test(error[key]) : isDeepStrictEqual(error?.[key], expected[key]));
  }
  return false;
}

function createAssert() {
  const assert = (value, message) => assert.ok(value, message);
  assert.AssertionError = AssertionError;
  assert.ok = (value, message) => { if (!value) fail(message, `Expected a truthy value, received ${inspect(value, 1)}`, {actual: value, expected: true, operator: '=='}); };
  assert.equal = assert.strictEqual = (actual, expected, message) => {
    if (!Object.is(actual, expected)) fail(message, `Expected values to be strictly equal:\n  actual:   ${inspect(actual, 1)}\n  expected: ${inspect(expected, 1)}`, {actual, expected, operator: 'strictEqual'});
  };
  assert.notEqual = assert.notStrictEqual = (actual, expected, message) => {
    if (Object.is(actual, expected)) fail(message, `Expected values to differ, both were ${inspect(actual, 1)}`, {actual, expected, operator: 'notStrictEqual'});
  };
  assert.deepEqual = assert.deepStrictEqual = (actual, expected, message) => {
    if (!isDeepStrictEqual(actual, expected)) fail(message, `Expected values to be deeply equal:\n  actual:   ${inspect(actual, 1)}\n  expected: ${inspect(expected, 1)}`, {actual, expected, operator: 'deepStrictEqual'});
  };
  assert.notDeepEqual = assert.notDeepStrictEqual = (actual, expected, message) => {
    if (isDeepStrictEqual(actual, expected)) fail(message, `Expected values not to be deeply equal: ${inspect(actual, 1)}`, {actual, expected, operator: 'notDeepStrictEqual'});
  };
  assert.throws = (fn, expected, message) => {
    if (typeof expected === 'string') { message = expected; expected = undefined; }
    try { fn(); } catch (error) {
      if (!errorMatches(error, expected)) fail(message, `The function threw an unexpected error: ${inspect(error?.message ?? error, 1)}`, {actual: error, expected, operator: 'throws'});
      return;
    }
    fail(message, 'Expected the function to throw.', {operator: 'throws'});
  };
  assert.doesNotThrow = (fn, message) => {
    try { fn(); } catch (error) { fail(typeof message === 'string' ? message : undefined, `Expected the function not to throw, but it threw: ${error?.message ?? error}`, {actual: error, operator: 'doesNotThrow'}); }
  };
  assert.rejects = async (promiseOrFn, expected, message) => {
    if (typeof expected === 'string') { message = expected; expected = undefined; }
    try { await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn); } catch (error) {
      if (!errorMatches(error, expected)) fail(message, `The promise rejected with an unexpected error: ${inspect(error?.message ?? error, 1)}`, {actual: error, expected, operator: 'rejects'});
      return;
    }
    fail(message, 'Expected the promise to reject.', {operator: 'rejects'});
  };
  assert.doesNotReject = async (promiseOrFn, message) => {
    try { await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn); } catch (error) { fail(message, `Expected the promise not to reject, but it rejected: ${error?.message ?? error}`, {actual: error, operator: 'doesNotReject'}); }
  };
  assert.match = (string, regexp, message) => { if (typeof string !== 'string' || !regexp.test(string)) fail(message, `Expected ${inspect(string, 1)} to match ${regexp}`, {actual: string, expected: regexp, operator: 'match'}); };
  assert.doesNotMatch = (string, regexp, message) => { if (typeof string === 'string' && regexp.test(string)) fail(message, `Expected ${inspect(string, 1)} not to match ${regexp}`, {actual: string, expected: regexp, operator: 'doesNotMatch'}); };
  assert.fail = message => fail(message, 'Failed');
  assert.strict = assert;
  return assert;
}

function normalizePath(value) {
  const parts = [];
  for (const part of String(value).replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return parts.join('/');
}
const dirname = file => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';

function createPath() {
  const join = (...parts) => {
    const joined = parts.filter(part => part !== '').join('/');
    const normal = normalizePath(joined);
    return (joined.startsWith('/') ? '/' : '') + (normal || (joined.startsWith('/') ? '' : '.'));
  };
  return {
    sep: '/', delimiter: ':', join,
    resolve: (...parts) => '/' + normalizePath(parts.reduce((acc, part) => String(part).startsWith('/') ? part : acc + '/' + part, '')),
    dirname: file => { const normal = String(file).replace(/\/+$/, ''); const index = normal.lastIndexOf('/'); return index < 0 ? '.' : index === 0 ? '/' : normal.slice(0, index); },
    basename: (file, ext) => { const base = String(file).replace(/\/+$/, '').split('/').pop(); return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base; },
    extname: file => { const base = String(file).split('/').pop(); const index = base.lastIndexOf('.'); return index > 0 ? base.slice(index) : ''; },
    normalize: file => (String(file).startsWith('/') ? '/' : '') + normalizePath(file),
    isAbsolute: file => String(file).startsWith('/'),
    relative: (from, to) => {
      const a = normalizePath(from).split('/').filter(Boolean), b = normalizePath(to).split('/').filter(Boolean);
      while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
      return [...a.map(() => '..'), ...b].join('/');
    }
  };
}

class ExitSignal extends Error { constructor(code) { super(`process.exit(${code})`); this.exitCode = code; } }

export function createProject(files, {onLog = () => {}} = {}) {
  let logged = 0, truncated = false;
  const write = (stream, text) => {
    if (truncated) return;
    logged += text.length;
    if (logged > LOG_LIMIT) { truncated = true; onLog('stderr', '\n[output truncated after 200 KB]\n'); return; }
    onLog(stream, text);
  };
  const timers = new Map();
  const counts = new Map();
  const consoleShim = {
    log: (...args) => write('stdout', format(args) + '\n'),
    info: (...args) => write('stdout', format(args) + '\n'),
    debug: (...args) => write('stdout', format(args) + '\n'),
    warn: (...args) => write('stderr', format(args) + '\n'),
    error: (...args) => write('stderr', format(args) + '\n'),
    trace: (...args) => write('stderr', format(['Trace:', ...args]) + '\n'),
    dir: value => write('stdout', inspect(value, 1) + '\n'),
    table: value => write('stdout', inspect(value, 1) + '\n'),
    assert: (condition, ...args) => { if (!condition) write('stderr', format(['Assertion failed:', ...args]) + '\n'); },
    time: (label = 'default') => timers.set(label, performance.now()),
    timeEnd: (label = 'default') => { if (timers.has(label)) { write('stdout', `${label}: ${(performance.now() - timers.get(label)).toFixed(3)}ms\n`); timers.delete(label); } },
    timeLog: (label = 'default') => { if (timers.has(label)) write('stdout', `${label}: ${(performance.now() - timers.get(label)).toFixed(3)}ms\n`); },
    count: (label = 'default') => { counts.set(label, (counts.get(label) || 0) + 1); write('stdout', `${label}: ${counts.get(label)}\n`); },
    group: () => {}, groupEnd: () => {}
  };
  const processShim = {
    argv: ['node', 'main.js'], env: {}, platform: 'browser', exitCode: 0,
    stdout: {write: text => { write('stdout', String(text)); return true; }},
    stderr: {write: text => { write('stderr', String(text)); return true; }},
    exit: code => { throw new ExitSignal(code ?? 0); },
    nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
    hrtime: Object.assign(previous => {
      const now = performance.now(), seconds = Math.floor(now / 1000), nanos = Math.floor((now % 1000) * 1e6);
      if (!previous) return [seconds, nanos];
      let ds = seconds - previous[0], dn = nanos - previous[1];
      if (dn < 0) { ds--; dn += 1e9; }
      return [ds, dn];
    }, {bigint: () => BigInt(Math.floor(performance.now() * 1e6))}),
    memoryUsage: () => ({heapUsed: 0, rss: 0})
  };

  const pathShim = createPath();
  const readable = file => {
    const key = normalizePath(file);
    if (!(key in files)) { const error = new Error(`ENOENT: no such file or directory, open '${file}'`); error.code = 'ENOENT'; throw error; }
    return key;
  };
  const fsShim = {
    readFileSync: (file, options) => {
      const text = files[readable(file)];
      return (typeof options === 'string' || options?.encoding) ? text : text;
    },
    existsSync: file => normalizePath(file) in files || Object.keys(files).some(name => name.startsWith(normalizePath(file) + '/')),
    readdirSync: dir => {
      const prefix = normalizePath(dir), entries = new Set();
      for (const name of Object.keys(files)) if (!prefix || name.startsWith(prefix + '/')) entries.add(name.slice(prefix ? prefix.length + 1 : 0).split('/')[0]);
      return [...entries].sort();
    },
    writeFileSync: () => { throw new Error('Writing files is not available while tests run.'); },
    promises: {}
  };
  fsShim.promises.readFile = async (file, options) => fsShim.readFileSync(file, options);

  const assert = createAssert();
  const util = {inspect: value => inspect(value, 1), isDeepStrictEqual, format: (...args) => format(args)};
  class EventEmitter {
    constructor() { this._events = new Map(); }
    on(name, fn) { if (!this._events.has(name)) this._events.set(name, []); this._events.get(name).push(fn); return this; }
    once(name, fn) { const wrapped = (...args) => { this.off(name, wrapped); fn(...args); }; return this.on(name, wrapped); }
    off(name, fn) { const list = this._events.get(name); if (list) this._events.set(name, list.filter(item => item !== fn)); return this; }
    emit(name, ...args) { const list = this._events.get(name); if (!list?.length) return false; for (const fn of [...list]) fn(...args); return true; }
  }
  const shared = {
    'node:assert': assert, assert, 'node:assert/strict': assert, 'assert/strict': assert,
    'node:perf_hooks': {performance}, perf_hooks: {performance},
    'node:util': util, util,
    'node:path': pathShim, path: pathShim, 'node:path/posix': pathShim,
    'node:fs': fsShim, fs: fsShim, 'node:fs/promises': fsShim.promises,
    'node:process': processShim, process: processShim,
    'node:console': consoleShim,
    'node:events': {EventEmitter}, events: {EventEmitter}
  };

  function resolve(from, spec) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
    const base = normalizePath((spec.startsWith('/') ? '' : dirname(from) + '/') + spec);
    for (const candidate of [base, base + '.js', base + '.cjs', base + '.json', base + '/index.js']) if (candidate in files) return candidate;
    return null;
  }

  // Each entry point gets a fresh module cache, like separate node processes.
  function loadEntry(entry, testApi) {
    const cache = new Map();
    const builtins = {...shared, 'node:test': testApi ? testApi.exports : createTestApi().exports};
    const mainModule = {exports: {}, filename: '/' + entry, id: entry, loaded: false, children: []};
    const load = (file, module) => {
      if (cache.has(file)) return cache.get(file).exports;
      module = module || {exports: {}, filename: '/' + file, id: file, loaded: false, children: []};
      cache.set(file, module);
      if (file.endsWith('.json')) { module.exports = JSON.parse(files[file]); module.loaded = true; return module.exports; }
      const local = spec => {
        if (Object.prototype.hasOwnProperty.call(builtins, spec)) return builtins[spec];
        const target = resolve(file, spec);
        if (!target) {
          const error = new Error(spec.startsWith('.') || spec.startsWith('/')
            ? `Cannot find module '${spec}' (required from ${file})`
            : `Module '${spec}' is not available in the in-browser runner. Use relative files or node:test, node:assert, node:fs (read-only), node:path, node:util, node:events or node:perf_hooks.`);
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        }
        return load(target);
      };
      local.main = mainModule;
      local.resolve = spec => resolve(file, spec) || spec;
      local.cache = {};
      const source = String(files[file]).replace(/^#!.*/, '');
      // Indirect eval keeps the candidate's line numbers intact in stack traces.
      const wrapper = (0, eval)(`(function (exports, require, module, __filename, __dirname, console, process) {${source}
})
//# sourceURL=${file}`);
      wrapper.call(module.exports, module.exports, local, module, '/' + file, '/' + dirname(file), consoleShim, processShim);
      module.loaded = true;
      return module.exports;
    };
    processShim.argv[1] = entry;
    return load(entry, mainModule);
  }

  return {
    log: write,
    runMain(file) { return loadEntry(file); },
    loadTests(file) {
      const testApi = createTestApi();
      loadEntry(file, testApi);
      return testApi.take();
    }
  };
}

function createTestApi() {
  const root = {name: '', hooks: {beforeEach: [], afterEach: [], before: [], after: []}, parent: null};
  let scope = root, registry = [];
  const register = (name, options, fn, extra = {}) => {
    if (typeof name === 'function') { fn = name; name = fn.name || '<anonymous>'; options = {}; }
    else if (typeof options === 'function') { fn = options; options = {}; }
    options = options || {};
    const prefix = [];
    for (let s = scope; s && s !== root; s = s.parent) prefix.unshift(s.name);
    registry.push({name: [...prefix, String(name)].join(' › '), fn, scope, skip: !!(options.skip || options.todo || extra.skip), timeout: options.timeout});
  };
  const test = (name, options, fn) => register(name, options, fn);
  test.skip = (name, options, fn) => register(name, options, fn, {skip: true});
  test.todo = (name, options, fn) => register(name, options, fn || (() => {}), {skip: true});
  test.only = test;
  const describe = (name, options, fn) => {
    if (typeof options === 'function') fn = options;
    const child = {name: String(name), hooks: {beforeEach: [], afterEach: [], before: [], after: []}, parent: scope};
    const previous = scope;
    scope = child;
    try {
      const result = fn?.();
      if (result && typeof result.then === 'function') throw new Error('describe() callbacks must be synchronous.');
    } finally { scope = previous; }
  };
  describe.skip = (name, options, fn) => { const start = registry.length; describe(name, options, fn); for (const item of registry.slice(start)) item.skip = true; };
  describe.only = describe;
  const hook = kind => fn => { scope.hooks[kind].push(fn); };
  const exports = Object.assign(test, {test, it: test, describe, suite: describe, beforeEach: hook('beforeEach'), afterEach: hook('afterEach'), before: hook('before'), after: hook('after')});
  exports.mock = {fn: (impl = () => {}) => {
    const calls = [];
    const mocked = function (...args) { calls.push({arguments: args, this: this}); return impl.apply(this, args); };
    mocked.mock = {calls, callCount: () => calls.length};
    return mocked;
  }};
  return {
    exports,
    take() { const items = registry; registry = []; return items; },
    root
  };
}

function chain(scope) {
  const scopes = [];
  for (let s = scope; s; s = s.parent) scopes.unshift(s);
  return scopes;
}

export function describeError(error, files = {}) {
  if (!(error instanceof Error)) return {message: `Thrown value: ${inspect(error, 1)}`};
  const message = error.name === 'AssertionError' ? error.message : `${error.name}: ${error.message}`;
  const known = Object.keys(files);
  const frames = String(error.stack || '').split('\n').slice(1)
    .map(line => line.trim())
    .filter(line => known.some(name => line.includes(`${name}:`)))
    .filter(line => !/runner-core\.js/.test(line))
    .map(line => line.replace(/^at (?:Object\.)?eval(?: \[as fn\])? \(/, 'at ('))
    .slice(0, 8);
  return {message, stack: frames.join('\n')};
}

// Runs test files (mode "tests") or an entry point (mode "main").
// onEvent receives {type:'log'|'test'|'done', ...} as the run progresses.
export async function runProject({files, mode = 'tests', testFiles = [], main = 'main.js'}, onEvent = () => {}) {
  const started = performance.now();
  const project = createProject(files, {onLog: (stream, text) => onEvent({type: 'log', stream, text})});
  const results = [];
  const emit = result => { results.push(result); onEvent({type: 'test', ...result}); };
  if (mode === 'main') {
    let exitCode = 0;
    try {
      if (!(main in files)) throw new Error(`Entry point ${main} was not found.`);
      project.runMain(main);
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      if (error instanceof ExitSignal) exitCode = error.exitCode;
      else { exitCode = 1; const info = describeError(error, files); project.log('stderr', `${info.message}${info.stack ? '\n' + info.stack : ''}\n`); }
    }
    const summary = {type: 'done', mode, exitCode, ms: Math.round(performance.now() - started)};
    onEvent(summary);
    return {...summary, results};
  }
  for (const file of testFiles) {
    let tests = [];
    try {
      if (!(file in files)) throw new Error(`Test file ${file} was not found.`);
      tests = project.loadTests(file);
    } catch (error) {
      const info = describeError(error, files);
      emit({file, name: 'Could not load test file', status: 'error', ms: 0, message: info.message, stack: info.stack});
      continue;
    }
    const scopesRun = new Set();
    for (const item of tests) {
      if (item.skip) { emit({file, name: item.name, status: 'skip', ms: 0}); continue; }
      const scopes = chain(item.scope);
      const testStart = performance.now();
      try {
        for (const s of scopes) if (!scopesRun.has(s)) { scopesRun.add(s); for (const fn of s.hooks.before) await fn(); }
        for (const s of scopes) for (const fn of s.hooks.beforeEach) await fn();
        const context = {name: item.name, diagnostic: text => project.log('stdout', `# ${text}\n`), skip: () => {}, todo: () => {}};
        try { await item.fn(context); }
        finally { for (const s of [...scopes].reverse()) for (const fn of s.hooks.afterEach) await fn(); }
        emit({file, name: item.name, status: 'pass', ms: Math.round(performance.now() - testStart)});
      } catch (error) {
        if (error instanceof ExitSignal) { emit({file, name: item.name, status: 'error', ms: Math.round(performance.now() - testStart), message: 'process.exit() was called during a test.'}); continue; }
        const info = describeError(error, files);
        emit({file, name: item.name, status: error?.name === 'AssertionError' ? 'fail' : 'error', ms: Math.round(performance.now() - testStart), message: info.message, stack: info.stack});
      }
    }
    for (const s of scopesRun) for (const fn of s.hooks.after) { try { await fn(); } catch {} }
  }
  const summary = {type: 'done', mode, ms: Math.round(performance.now() - started), passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status === 'fail' || r.status === 'error').length};
  onEvent(summary);
  return {...summary, results};
}
