// Runs guided API projects (Express, Django REST, FastAPI, Spring Boot) in a
// Docker image with the framework installed: tests, the demo entry point and
// terminal commands. Results come back in the same shape as the Python
// harness, so phases, hints, reviews and the UI treat every stack alike.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {LANGUAGES} from './problems.mjs';
import {parseResults} from './sandbox.mjs';
import {RESET_WORK} from './warm-sandbox.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(ROOT, 'harness');
const DOCKER_DIR = path.join(ROOT, 'docker');
const quote = name => `'${String(name).replace(/'/g, `'\\''`)}'`;

// How each stack runs. memory and writable matter for the JVM and Maven.
const STACKS = {
  express: {tests: targets => `node --test --test-reporter=/dg/node-reporter.mjs ${targets.map(quote).join(' ')}`, main: 'node demo.js'},
  django: {tests: targets => `python /dg/pyrunner.py tests ${targets.map(quote).join(' ')}`, main: 'python /dg/pyrunner.py main demo.py', env: {PYTHONHASHSEED: '0', PYTHONUNBUFFERED: '1'}},
  fastapi: {tests: targets => `python /dg/pyrunner.py tests ${targets.map(quote).join(' ')}`, main: 'python /dg/pyrunner.py main demo.py', env: {PYTHONHASHSEED: '0', PYTHONUNBUFFERED: '1'}},
  spring: {
    tests: targets => {
      const classes = targets.map(t => path.posix.basename(t, '.java')).join(',');
      return `mvn -q test -Dtest=${quote(classes)} -Dsurefire.failIfNoSpecifiedTests=false -DtrimStackTrace=true; for f in target/surefire-reports/TEST-*.xml; do [ -f "$f" ] && printf '\\n@@JUNIT@@\\n' && cat "$f"; done; true`;
    },
    memory: '2g', writable: true, timeout: 300000, results: 'junit'
  },
  // Guided problems in TypeScript: Node 22 strips the types and runs the files.
  typescript: {
    tests: targets => `node --test --experimental-strip-types --disable-warning=ExperimentalWarning --test-reporter=/dg/node-reporter.mjs ${targets.map(quote).join(' ')}`,
    main: 'node --experimental-strip-types --disable-warning=ExperimentalWarning main.ts'
  },
  // Java: compile src/ and tests/ with javac, then run JUnit 5's console
  // launcher, which writes the same XML report as Maven's Surefire.
  java: {
    // The XML report looks up the host name; with no network that lookup waits
    // 15 seconds, so Java reads it from a hosts file instead.
    tests: () => `${javaBuild('src tests')} && printf '127.0.0.1 localhost %s\\n' "$(hostname)" > /tmp/dg-hosts && java -XX:+UseSerialGC -Xmx1g -Djdk.net.hosts.file=/tmp/dg-hosts -jar /opt/junit/junit.jar execute --class-path /tmp/dg-out --scan-class-path --reports-dir /tmp/dg-reports --disable-banner --disable-ansi-colors --details=none 2>&1 | tail -c 20000; for f in /tmp/dg-reports/*.xml; do [ -f "$f" ] && printf '\\n@@JUNIT@@\\n' && cat "$f"; done; true`,
    main: `${javaBuild('src')} && java -XX:+UseSerialGC -Xmx1g -cp /tmp/dg-out Main`,
    memory: '1536m', timeout: 180000, results: 'junit', junitFile: className => `tests/${className.split('.').pop()}.java`
  },
  // Go: one module; the tests package in tests/ imports the code. Test
  // functions are listed with their files first, because go test -json reports
  // tests by name only.
  go: {
    tests: () => `for f in tests/*_test.go; do [ -f "$f" ] && grep -oE '^func Test[A-Za-z0-9_]*' "$f" | sed "s|^func |@@GOTEST@@ $f |"; done; go test -json -vet=off -count=1 ./tests/... 2>&1; true`,
    main: 'go run .',
    env: {GOTOOLCHAIN: 'local', CGO_ENABLED: '0', GOFLAGS: '-buildvcs=false'},
    writable: true, timeout: 180000, results: 'gotest'
  }
};

// Compiles every .java file under the given folders into /tmp/dg-out. A
// compile error prints @@JAVAC@@ and the compiler's output instead.
function javaBuild(folders) {
  return `rm -rf /tmp/dg-out /tmp/dg-reports && mkdir -p /tmp/dg-out /tmp/dg-reports && find ${folders} -name '*.java' 2>/dev/null > /tmp/dg-sources.txt; `
    + `if ! javac -J-XX:+UseSerialGC -J-XX:TieredStopAtLevel=1 -encoding UTF-8 -Xlint:none -d /tmp/dg-out -cp /opt/junit/junit.jar @/tmp/dg-sources.txt > /tmp/dg-javac.txt 2>&1; then printf '\\n@@JAVAC@@\\n'; head -c 8000 /tmp/dg-javac.txt; false; fi`;
}

// go test -json events into result records. Only leaf tests are reported: a
// test with subtests (t.Run) is reported through its subtests.
export function parseGoTest(text) {
  const declared = new Map(), tests = new Map(), output = [];
  let buildFailed = false;
  for (const line of String(text).split('\n')) {
    if (line.startsWith('@@GOTEST@@ ')) { const [, file, name] = line.trim().split(/\s+/); declared.set(name, file); continue; }
    if (!line.startsWith('{')) { if (/\[(build|setup) failed\]/.test(line)) buildFailed = true; else if (line.trim()) output.push(line); continue; }
    let event;
    try { event = JSON.parse(line); } catch { output.push(line); continue; }
    if (event.Action === 'build-fail' || /\[(build|setup) failed\]/.test(event.Output || '')) buildFailed = true;
    if (event.Action === 'build-output' || (event.Action === 'output' && !event.Test)) { const text = String(event.Output || '').replace(/\n$/, ''); if (text && !/^(PASS|FAIL|ok\s|\?\s)/.test(text.trim())) output.push(text); continue; }
    if (!event.Test) continue;
    const test = tests.get(event.Test) || {out: []};
    if (event.Action === 'output') test.out.push(event.Output || '');
    else if (['pass', 'fail', 'skip'].includes(event.Action)) { test.action = event.Action; test.elapsed = event.Elapsed; }
    tests.set(event.Test, test);
  }
  const names = [...tests.keys()];
  const results = [];
  for (const name of names) {
    const test = tests.get(name);
    if (!test.action || names.some(other => other.startsWith(name + '/'))) continue;
    const top = name.split('/')[0];
    const phase = top.match(/^TestPhase(\d)/);
    const file = declared.get(top) || (phase ? `tests/phase${phase[1]}_test.go` : 'tests/custom_test.go');
    const message = test.action === 'fail' ? test.out.filter(l => !/^\s*(=== (RUN|PAUSE|CONT|NAME)|--- (FAIL|PASS|SKIP))/.test(l)).join('').trim().slice(0, 2000) || 'Test failed' : undefined;
    results.push({type: 'test', file, name: humanizeGo(name), status: test.action === 'pass' ? 'pass' : test.action === 'skip' ? 'skip' : 'fail', ms: Math.round((test.elapsed || 0) * 1000), ...(message ? {message} : {})});
  }
  return {results, output: output.join('\n'), buildFailed};
}
// TestPhase1UnfriendClearsBoth/blocked_user → "unfriend clears both › blocked user"
const humanizeGo = name => name.split('/').map((part, i) => i
  ? part.replace(/_/g, ' ')
  : part.replace(/^Test(Phase\d+)?_?/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase() || part).join(' › ');

export const imageTag = language => `debug-gym/${LANGUAGES[language].image}:1`;

// Builds the stack's image from docker/ the first time it is needed.
const preparing = new Map();
let readyAt = new Map();
export async function ensureStackImage(run, language, progress = () => {}) {
  const tag = imageTag(language);
  if (Date.now() - (readyAt.get(tag) || 0) < 600000) return;
  const info = await run('docker', ['info', '--format', '{{.ServerVersion}}'], {timeout: 8000}).catch(() => ({code: 1, output: ''}));
  if (info.code !== 0 || !/^\d+\.\d+/m.test(info.output)) throw new Error('Docker is not running. API projects run in Docker: start Docker Desktop and try again.');
  const exists = await run('docker', ['image', 'inspect', tag], {timeout: 10000});
  if (exists.code !== 0 || !exists.output.trim().startsWith('[')) {
    if (!preparing.has(tag)) preparing.set(tag, (async () => {
      progress(`Building the ${LANGUAGES[language].label} environment (${tag}). This happens once, needs an internet connection and can take a few minutes…`);
      const built = await run('docker', ['build', '-t', tag, '-f', path.join(DOCKER_DIR, `${LANGUAGES[language].image}.Dockerfile`), DOCKER_DIR], {timeout: 1800000});
      if (built.code !== 0) throw new Error(`Could not build ${tag}: ` + built.output.slice(-600));
    })().finally(() => preparing.delete(tag)));
    await preparing.get(tag);
  }
  readyAt.set(tag, Date.now());
}

// The warm container for one practice session in a stack.
export const stackSpec = (language, key, sourceDir, overlayDir) => ({
  key, image: imageTag(language), memory: STACKS[language].memory, writable: STACKS[language].writable,
  mounts: [{source: sourceDir, target: '/candidate'}, ...(overlayDir ? [{source: overlayDir, target: '/canonical'}] : []), {source: HARNESS, target: '/dg'}]
});

const decode = text => String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&');
// addingAFriendshipTwiceIsHarmless() → "adding a friendship twice is harmless"
const humanize = name => decode(name).replace(/\(\)$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

// Surefire XML reports into result records; the test file comes from the class
// name (Maven layout by default; plain Java problems keep tests in tests/).
const mavenFile = className => `src/test/java/${className.replace(/\./g, '/')}.java`;
export function parseJunit(text, fileFor = mavenFile) {
  const [output, ...reports] = String(text).split('@@JUNIT@@');
  const results = [];
  for (const report of reports) {
    for (const match of report.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
      const body = match[2] || '';
      const problem = /<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/.exec(body);
      const className = decode(attrs.classname || '').split('$')[0];
      const message = problem ? decode(/message="([^"]*)"/.exec(problem[2])?.[1] || (problem[3] || '').split('\n')[0]) : '';
      results.push({type: 'test', file: fileFor(className), name: humanize(attrs.name || 'test'),
        status: /<skipped\b/.test(body) ? 'skip' : problem ? (problem[1] === 'failure' ? 'fail' : 'error') : 'pass',
        ms: Math.round(Number(attrs.time || 0) * 1000), ...(problem ? {message: message.slice(0, 2000), stack: decode(problem[3] || '').split('\n').slice(1, 8).join('\n')} : {})});
    }
  }
  return {results, output: output.replace(/\n+$/, '')};
}

// mode: 'tests' (targets are test files) or 'main' (the demo entry point).
// With a pool and key the session's warm container is reused.
export async function runStack(run, {language, sourceDir, overlayDir, mode = 'tests', targets = [], pool = null, key = null}) {
  const stack = STACKS[language];
  if (!stack) throw new Error('Unknown stack.');
  for (const name of targets) if (!/^[\w./-]+$/.test(name) || name.includes('..')) throw new Error('Unsupported file name for the runner.');
  if (mode === 'main' && !stack.main) throw new Error(`${LANGUAGES[language].label} projects have no demo entry point. Run the tests instead.`);
  const command = mode === 'main' ? stack.main : stack.tests(targets);
  const script = `${RESET_WORK}; cp -R /candidate/. /work/ && ${overlayDir ? 'cp -R /canonical/. /work/ && ' : ''}cd /work && ${command}`;
  const timeout = stack.timeout || 120000;
  const started = Date.now();
  let result;
  if (pool && key) result = await pool.exec(stackSpec(language, key, sourceDir, overlayDir), script, {timeout, env: stack.env || {}});
  else {
    const spec = stackSpec(language, null, sourceDir, overlayDir);
    const name = `dg-stack-${randomUUID()}`;
    const args = ['run', '--rm', '--name', name, '--network', 'none', '--memory', spec.memory || '1g', '--cpus', '2', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      ...(spec.writable ? [] : ['--read-only']), '--tmpfs', '/tmp:rw,exec,nosuid,size=256m', '--tmpfs', '/work:rw,exec,nosuid,size=768m', '-e', 'HOME=/tmp', '-e', 'PYTHONDONTWRITEBYTECODE=1',
      ...Object.entries(stack.env || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
      ...spec.mounts.flatMap(m => ['--mount', `type=bind,source=${m.source},target=${m.target},readonly`]), '--entrypoint', '/bin/sh', spec.image, '-c', script];
    try { result = await run('docker', args, {timeout}); }
    finally { await run('docker', ['rm', '-f', name], {timeout: 10000}).catch(() => {}); }
  }
  let parsed;
  if (mode === 'tests' && stack.results === 'junit') {
    const junit = parseJunit(result.output, stack.junitFile);
    parsed = {results: junit.results, output: junit.output, done: null};
  } else if (mode === 'tests' && stack.results === 'gotest') {
    const go = parseGoTest(result.output);
    parsed = {results: go.results, output: go.output, done: null, buildFailed: go.buildFailed};
  } else parsed = parseResults(result.output);
  // A compile or build error leaves no test results: report it as one error
  // against the first test file, with the compiler's message, so the phase
  // shows what went wrong instead of "no tests ran".
  const compileError = String(parsed.output).includes('@@JAVAC@@') || !!parsed.buildFailed;
  parsed.output = String(parsed.output).replace(/\n?@@JAVAC@@\n?/g, '\n');
  if (mode === 'tests' && compileError && !parsed.results.length && targets.length) {
    parsed.results = [{type: 'test', file: targets[0], name: 'The code does not compile', status: 'error', ms: 0, message: parsed.output.trim().split('\n').slice(0, 25).join('\n').slice(0, 2000)}];
  }
  const failed = parsed.results.some(r => r.status === 'fail' || r.status === 'error');
  return {
    results: parsed.results,
    output: result.timedOut ? `${parsed.output}\n[Stopped: the run exceeded ${Math.round(timeout / 1000)} seconds]` : parsed.output,
    exitCode: parsed.done?.exitCode ?? (failed || (mode === 'tests' && !parsed.results.length) ? 1 : result.code),
    ms: Date.now() - started, timedOut: result.timedOut, tests: targets
  };
}

// A terminal command on a fresh copy of the workspace, in the stack's image.
export async function stackCommand(pool, {language, key, sourceDir, overlayDir, command}) {
  const result = await pool.exec(stackSpec(language, key, sourceDir, overlayDir), `${RESET_WORK}; cp -a /candidate/. /work/${overlayDir ? ' && cp -a /canonical/. /work/' : ''} && cd /work && ${command}`, {timeout: 180000, env: STACKS[language].env || {}});
  return {output: result.output.slice(-100000), code: result.code, timedOut: result.timedOut, ms: result.ms};
}
