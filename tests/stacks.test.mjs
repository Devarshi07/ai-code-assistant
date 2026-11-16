// Framework stacks for back-end API projects: language table, test targets
// and the JUnit report parser. These run without Docker.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES, isStack, isApi, problemSummary} from '../problems.mjs';
import {testTargets} from '../practice.mjs';
import {parseJunit, parseGoTest} from '../stack-runner.mjs';

test('every stack names an image, phase tests and a canonical-file rule', () => {
  for (const id of ['express', 'django', 'fastapi', 'spring', 'typescript', 'java', 'go']) {
    const lang = LANGUAGES[id];
    assert.ok(isStack(id), id);
    assert.equal(isApi(id), ['express', 'django', 'fastapi', 'spring'].includes(id), `${id}: only framework stacks are API projects`);
    assert.ok(lang.image, id);
    for (const n of [1, 2, 3]) assert.ok(lang.canonical(lang.test(n)), `${id} phase ${n} test is canonical`);
    assert.ok(lang.custom(lang.customExample), `${id} custom example counts as a custom test`);
    assert.ok(!lang.canonical('README.md'));
  }
  assert.ok(!isStack('python') && !isStack('javascript'));
  assert.equal(LANGUAGES.spring.main, null);
});

test('spring test targets: phase classes first, then the candidate\'s own tests', () => {
  const state = {language: 'spring', unlocked: 2, readonly: ['src/test/java/com/debuggym/api/Phase1Test.java', 'src/test/java/com/debuggym/api/Phase2Test.java']};
  const files = ['pom.xml', 'src/main/java/com/debuggym/api/Application.java', 'src/test/java/com/debuggym/api/Phase1Test.java', 'src/test/java/com/debuggym/api/Phase2Test.java', 'src/test/java/com/debuggym/api/EdgeCaseTest.java'];
  assert.deepEqual(testTargets(state, files), ['src/test/java/com/debuggym/api/Phase1Test.java', 'src/test/java/com/debuggym/api/Phase2Test.java', 'src/test/java/com/debuggym/api/EdgeCaseTest.java']);
});

test('problem summaries mark framework problems as API projects', () => {
  const base = {id: 'x', title: 'X', difficulty: 'Medium', pattern: 'p', summary: 's', minutes: 60};
  assert.equal(problemSummary({...base, languages: ['express']}).track, 'api');
  assert.equal(problemSummary({...base, languages: ['python', 'javascript']}).track, 'algorithm');
  assert.equal(problemSummary({...base, languages: ['spring']}).languageLabels.spring, 'Java · Spring Boot');
});

test('surefire XML becomes result records with file, status and message', () => {
  const xml = `[INFO] build output
@@JUNIT@@
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.debuggym.api.Phase1Test" tests="3">
  <testcase name="transferMovesMoney()" classname="com.debuggym.api.Phase1Test" time="0.21"/>
  <testcase name="insufficientFundsIs422()" classname="com.debuggym.api.Phase1Test" time="0.05">
    <failure message="Status expected:&lt;422&gt; but was:&lt;500&gt;" type="java.lang.AssertionError">java.lang.AssertionError: Status
	at com.debuggym.api.Phase1Test.insufficientFundsIs422(Phase1Test.java:40)</failure>
  </testcase>
  <testcase name="nested()" classname="com.debuggym.api.Phase1Test$Inner" time="0.01"><error message="boom" type="java.lang.IllegalStateException"/></testcase>
</testsuite>`;
  const {results, output} = parseJunit(xml);
  assert.equal(output, '[INFO] build output');
  assert.deepEqual(results.map(r => [r.file, r.name, r.status]), [
    ['src/test/java/com/debuggym/api/Phase1Test.java', 'transfer moves money', 'pass'],
    ['src/test/java/com/debuggym/api/Phase1Test.java', 'insufficient funds is422', 'fail'],
    ['src/test/java/com/debuggym/api/Phase1Test.java', 'nested', 'error']
  ]);
  assert.equal(results[1].message, 'Status expected:<422> but was:<500>');
  assert.equal(results[0].ms, 210);
});

test('a guided problem in Java or Go is not an API project', () => {
  const base = {id: 'x', title: 'X', difficulty: 'Medium', pattern: 'p', summary: 's', minutes: 45};
  assert.equal(problemSummary({...base, languages: ['python', 'javascript', 'typescript', 'java', 'go']}).track, 'algorithm');
});

test('plain Java tests map to tests/<Class>.java, nested classes included', () => {
  const xml = '@@JUNIT@@\n<testsuite><testcase name="addsNumbers()" classname="tests.Phase1Test" time="0.01"/><testcase name="addsNegatives()" classname="tests.Phase1Test$Negatives" time="0"/></testsuite>';
  const {results} = parseJunit(xml, className => `tests/${className.split('.').pop()}.java`);
  assert.deepEqual(results.map(r => [r.file, r.name, r.status]), [['tests/Phase1Test.java', 'adds numbers', 'pass'], ['tests/Phase1Test.java', 'adds negatives', 'pass']]);
});

test('go test -json: leaf tests by file, subtests named, failures explained, build errors flagged', () => {
  const events = [
    '@@GOTEST@@ tests/phase1_test.go TestPhase1AddsNumbers',
    '@@GOTEST@@ tests/phase1_test.go TestPhase1Table',
    '@@GOTEST@@ tests/my_test.go TestMine',
    JSON.stringify({Action: 'run', Test: 'TestPhase1AddsNumbers'}),
    JSON.stringify({Action: 'pass', Test: 'TestPhase1AddsNumbers', Elapsed: 0.002}),
    JSON.stringify({Action: 'run', Test: 'TestPhase1Table'}),
    JSON.stringify({Action: 'run', Test: 'TestPhase1Table/small_numbers'}),
    JSON.stringify({Action: 'pass', Test: 'TestPhase1Table/small_numbers'}),
    JSON.stringify({Action: 'output', Test: 'TestPhase1Table/wrong', Output: '    phase1_test.go:29: Add(2, 2) = 4, want 5\n'}),
    JSON.stringify({Action: 'fail', Test: 'TestPhase1Table/wrong'}),
    JSON.stringify({Action: 'fail', Test: 'TestPhase1Table'}),
    JSON.stringify({Action: 'pass', Test: 'TestMine'})
  ].join('\n');
  const {results, buildFailed} = parseGoTest(events);
  assert.equal(buildFailed, false);
  assert.deepEqual(results.map(r => [r.file, r.name, r.status]), [
    ['tests/phase1_test.go', 'adds numbers', 'pass'],
    ['tests/phase1_test.go', 'table › small numbers', 'pass'],
    ['tests/phase1_test.go', 'table › wrong', 'fail'],
    ['tests/my_test.go', 'mine', 'pass']
  ]);
  assert.match(results[2].message, /want 5/);
  assert.equal(parseGoTest('FAIL\tdebuggym/x/tests [build failed]').buildFailed, true);
});
