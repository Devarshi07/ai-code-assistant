# Authoring structured AI-coding problems

Each structured problem is a small, realistic multi-file codebase worked through in **three phases** inside one ~45-minute session. This mirrors the AI-enabled coding interview format: fix a bug in unfamiliar code, implement a core feature with an AI assistant, then make the solution scale.

| Phase | `kind` | What the candidate does |
| --- | --- | --- |
| 1 | `bug` | Read the codebase, find and fix a planted bug. Typical bugs are non-algorithmic: off-by-one, wrong comparison, wrong type/rounding, shared mutable state, missing visited set, swapped coordinates, wrong default. |
| 2 | `feature` | Implement the primary algorithm or feature, usually where the codebase has a stub. Harder than a LeetCode medium, about 60–150 lines of candidate code. |
| 3 | `optimize` | Larger inputs or tighter limits break a straightforward phase-2 solution. The candidate picks a better algorithm or data structure. |

Every problem ships in **Python** and **JavaScript** with equivalent behavior, and can also ship in **TypeScript**, **Java** and **Go** (see "More languages" below).

## Directory layout

```
problems/<id>/problem.json
problems/<id>/<lang>/starter/**           initial workspace (lang = python | javascript)
problems/<id>/<lang>/phase2/**            files added when phase 2 unlocks (at least the phase-2 tests)
problems/<id>/<lang>/phase3/**            files added when phase 3 unlocks (at least the phase-3 tests)
problems/<id>/<lang>/solution/phase1/**   reference fix: only the files that change
problems/<id>/<lang>/solution/phase2/**   straightforward phase-2 implementation, layered over phase1
problems/<id>/<lang>/solution/phase3/**   optimized implementation, layered over phase2
```

Overlays are applied in order: `starter`, `phase2`, `phase3`, `solution/phase1`, `solution/phase2`, `solution/phase3`. Each overlay file replaces a file of the same path. The phase-2 solution must be a sensible straightforward approach, such as brute force or plain BFS, that **passes phases 1–2 and fails phase 3**. Don't make it artificially terrible.

### Fixed file names

| | Python | JavaScript |
| --- | --- | --- |
| Entry point (Run ▸ main) | `main.py` | `main.js` |
| Phase tests | `tests/test_phase1.py`, `tests/test_phase2.py`, `tests/test_phase3.py` | `tests/phase1.test.js`, `tests/phase2.test.js`, `tests/phase3.test.js` |
| Project readme | `README.md` | `README.md` |

`tests/test_phase1.py` / `tests/phase1.test.js` live in `starter/`. Later phase tests live only in their phase overlay. The app treats these test files as read-only, canonical tests.

## Codebase expectations

- Make it look like real code someone else wrote: 4–8 source files, roughly 150–450 lines in the starter. Include data models or classes, one or two helpers, docstrings or comments where a real codebase would have them, and a README that explains the domain and how the pieces fit.
- `main.py` / `main.js` runs a small demo that prints something meaningful, such as a rendered board or a sample schedule. It must run cleanly on the final solution. It may raise on the starter because of the bug or stub.
- The phase-2 stub should exist in the starter, raising `NotImplementedError("Phase 2: ...")` in Python or throwing `new Error('Not implemented: ...')` in JavaScript. Phase-3 work usually changes the same function or adds a helper or index.
- Keep the bug honest. Phase-1 instructions describe the **symptom** (a user report or failing behavior), never the root cause. At least one phase-1 test fails on the starter, and at least one passes.
- Use no third-party packages. Use only the Python 3.12 standard library or plain JavaScript.

### Python conventions

- Use a package directory for the source (for example `warehouse/__init__.py`, `warehouse/grid.py`). Tests import it from the project root: `from warehouse.grid import Grid`.
- Tests use `unittest` (`class XTests(unittest.TestCase)`). The harness puts the project root on `sys.path` and imports each test file by path, so `tests/__init__.py` is optional.
- Name test methods descriptively (`test_one_way_tiles_block_reverse_travel`). The UI shows `ClassName › one way tiles block reverse travel`.
- `setUpClass`/`tearDownClass` and `setUpModule`/`tearDownModule` are supported. Put expensive shared inputs, like a large generated dictionary, in `setUpClass` so they are built once and not timed.

### JavaScript conventions (CommonJS, runs in a browser Web Worker)

- Write source files under `src/` and use `module.exports = { ... }` and `const { X } = require('./x')`. Relative requires may omit `.js`.
- Tests use `const { test, describe } = require('node:test')` and `const assert = require('node:assert/strict')`. They must also run unchanged under real Node with `node --test`.
- Available assertions: `equal`, `notEqual`, `deepEqual`, `notDeepEqual`, `ok`, `throws`, `doesNotThrow`, `rejects`, `match`, `fail`.
- Available modules are relative files, `node:test`, `node:assert/strict`, `node:fs` (read-only `readFileSync`/`existsSync` over the project files), `node:path`, `node:util`, `node:events`, and `node:perf_hooks`. Nothing else.
- Read data files as `fs.readFileSync(path.join(__dirname, 'data', 'x.txt'), 'utf8')`.
- `main.js` can use `if (require.main === module) main();`.

## Phase-3 performance tests

- Measure with `time.perf_counter()` or `performance.now()` and assert a limit with a clear message, for example `self.assertLess(elapsed, 1.0, f"took {elapsed:.2f}s; must be under 1.0s")`.
- Build large inputs inside the test with a **seeded** generator (for example `random.Random(7)` or a small LCG in JavaScript) instead of committing big data files. Data files that are committed must stay under 100 KB each.
- Calibrate with wide margins. The optimized solution should use at most a fifth of the limit, and the phase-2 solution should take at least three times the limit. It must still finish, or hit the harness limit, within **10 seconds** per test. The Python harness aborts any test after 12 s, and the JavaScript runner abandons a run after 30 s.
- Phase-3 test files should also re-check correctness on a few medium cases, so an optimization that breaks behavior fails.

## problem.json

```json
{
  "id": "maze-solver",
  "title": "Maze Solver",
  "difficulty": "Medium",
  "pattern": "Graph Search & Pathfinding",
  "summary": "One sentence for the problem library.",
  "minutes": 45,
  "languages": ["python", "javascript"],
  "overview": "Markdown: the scenario and a short tour of the codebase. No spoilers.",
  "phases": [
    {
      "kind": "bug",
      "title": "Short phase title (no spoilers)",
      "instructions": "Markdown: what is wrong from the user's point of view and what done means.",
      "hints": ["gentle direction", "more specific", "nearly the answer"],
      "answer": "Markdown for the answer key: root cause, fix, how to verify."
    },
    { "kind": "feature", "title": "...", "instructions": "...", "hints": ["...", "...", "..."], "answer": "Approach and complexity." },
    { "kind": "optimize", "title": "...", "instructions": "...", "hints": ["...", "...", "..."], "answer": "Optimized approach, complexity, why the phase-2 approach breaks." }
  ],
  "debrief": [
    "Problem-specific question about the root cause and how it was confirmed.",
    "Question about the phase-2 design and complexity.",
    "Question about the phase-3 tradeoff, or how AI output was verified."
  ]
}
```

Any markdown field (`overview`, `instructions`, `hints[i]`, `answer`) can be a plain string, or an object `{ "python": "...", "javascript": "..." }` when names differ between languages (`find_path` vs `findPath`). Markdown supports headings, paragraphs, `inline code`, fenced code blocks, bullet and numbered lists, **bold** and *italic*.

`difficulty` is `Easy`, `Medium`, or `Hard`. An Easy problem has a smaller codebase and a gentler phase 3.

## Validation

```
node scripts/validate-problems.mjs [problem-id ...]
```

The validator checks the schema and runs each language through every stage:

1. starter: phase-1 tests fail, and at least one passes;
2. with the phase-1 fix: phase 1 passes, and phase-2 tests fail;
3. with the phase-2 solution: phases 1–2 pass, and phase-3 tests fail;
4. with the phase-3 solution: every phase passes, and `main` exits cleanly.

It reports the slowest phase-3 test per stage to help you calibrate time limits.

## More languages: TypeScript, Java and Go

Guided problems can also ship in `typescript`, `java` and `go`, with the same story, phases, bugs and checks as the Python and JavaScript versions. They run in Docker images that the app builds on first use: TypeScript in `debug-gym/node-api:1` (Node 22), Java in `debug-gym/java-junit:1` (JDK 21 and the JUnit 5 console launcher), Go in `debug-gym/go-test:1` (Go 1.24). Containers have no network, so use only the standard library.

| | TypeScript | Java | Go |
| --- | --- | --- | --- |
| Entry point (Run ▸ main) | `main.ts` | `src/Main.java` (default package) | `main.go` (`package main`) |
| Phase tests | `tests/phase1.test.ts` … | `tests/Phase1Test.java` … | `tests/phase1_test.go` … |
| Source | `src/*.ts` | `src/<package>/*.java` | `<package>/*.go` under one module |
| Project files | `package.json` with `"type": "module"` | none | `go.mod`: `module debuggym/<id>` and `go 1.24` |
| A run | `node --test` with type stripping, under 1 s | `javac` then JUnit, 1 to 3 s | `go test -json ./tests/...`, 1 to 3 s |

### Porting an existing problem

- Port from the JavaScript version (closest in shape), and read the Python one for anything unclear. Keep the scenario, the README, the data files, the planted bug (the same mistake in this language), the stub, and every test case: the same inputs, the same expected outputs, and names that read the same in the UI. Don't add or drop checks.
- Use the language's normal style: `camelCase` methods and `PascalCase` classes in TypeScript and Java; exported `PascalCase` and unexported `camelCase` in Go, errors as values, and so on. Keep the starter about the same size as the JavaScript one.
- In `problem.json`, add the language to `languages` (order: `python`, `javascript`, `typescript`, `java`, `go`). Every per-language text (`overview`, `instructions`, `hints`, `answer`) needs an entry for the new language, with its own file paths and identifiers (`src/graph.ts`, `src/campfire/SocialGraph.java`, `campfire/graph.go`). A plain string that names files, functions or code from one language must become a per-language object. The validator rejects an object with a language missing.
- Phase 3 timing: these languages run at different speeds, so recalibrate rather than copy the limit. Scale the generated input or the limit so that the optimized solution uses at most a fifth of the limit and the phase-2 solution takes at least three times the limit, then run the validator three times. Other jobs may be running on the machine, so keep both margins: a ratio of 10x or more between the two solutions is a safe target. Java: run a short warm-up before the timed part, so JIT compilation isn't timed.
- The validator reports whole-test times, which include building inputs and warm-ups. `node scripts/measure-phase3.mjs <id> [--lang=typescript,java,go] [--runs=3] [--untimed]` reports the timed part itself: it runs the phase-3 tests against the optimized solution with every `elapsed < limit` (or Go's `elapsed >= limit`) comparison forced to fail, so each failure message shows the measured time, and against the phase-2 solution unchanged. `--untimed` also runs the phase-2 solution with the time checks forced to pass, which confirms that expected values computed with the optimized solution agree with the plain one. Name the measured duration `elapsed…` in the test so the script can find it.

### TypeScript conventions

- ES modules: `import { SocialGraph } from './graph.ts'`, always with the `.ts` extension. Import types with `import type { Member } from './models.ts'`.
- Node runs the files by stripping the types, with no type check. Only erasable syntax works: type annotations, interfaces and type aliases are fine, but **not** `enum`, `namespace`, constructor parameter properties (`constructor(private x: number)`), decorators or `import x = require()`. Use `as const` objects or string unions instead of enums.
- Tests: `import { describe, test } from 'node:test'` and `import assert from 'node:assert/strict'`. Read data files with `readFileSync(new URL('../data/x.csv', import.meta.url), 'utf8')`.
- Throw `new Error('Not implemented: ...')` for the phase-2 stub.

### Java conventions

- Production code lives in a short lowercase package named after the product (`src/campfire/SocialGraph.java` with `package campfire;`). `src/Main.java` is in the default package and imports from there.
- Tests are JUnit 5: `package tests;`, `import org.junit.jupiter.api.Test;`, static imports from `org.junit.jupiter.api.Assertions`. Test classes and methods can be package-private. Helpers in `tests/` must not have names ending in `Test` unless they hold tests. Name methods descriptively (`unfriendingClearsBothFriendLists`): the UI shows them as "unfriending clears both friend lists".
- Tests run from the project root, so read data files as `Path.of("data", "members.csv")`.
- Throw `new UnsupportedOperationException("Phase 2: ...")` for the stub.

### Go conventions

- One module, `debuggym/<id>`, with the code in a package directory (`campfire/graph.go`, `package campfire`) and `main.go` at the root.
- Tests live in `tests/` as `package tests` and import the code (`import "debuggym/friend-recommender/campfire"`). Name phase test functions `TestPhase1…`, `TestPhase2…`, `TestPhase3…` (`TestPhase1UnfriendClearsBothLists`); the UI shows "unfriend clears both lists". Subtests (`t.Run("blocked member", …)`) appear as "… › blocked member".
- `go test` runs with `tests/` as the working directory, so read data files as `../data/members.csv`.
- `panic("phase 2: not implemented")` for the stub, or return an error if the function already returns one.

## Back-end API projects (Express, Django REST, FastAPI, Spring Boot)

An API project is a guided problem whose `languages` lists one framework stack instead of `python`/`javascript`. It is a real service codebase — routes or controllers, services, models or repositories, validation and error handling — worked through in the same three phases. Its tests run in a Docker image with the framework installed (`stack-runner.mjs`), offline, in the session's warm container.

| Stack (`languages` entry) | Image | Entry point | Phase tests | Typical layout |
| --- | --- | --- | --- | --- |
| `express` | Node.js 22 + Express 4 (`docker/node-api.Dockerfile`) | `demo.js` | `tests/phase1.test.js`… | `src/app.js`, `src/routes/`, `src/controllers/`, `src/services/`, `src/models/` or `src/store/`, `src/middleware/`, `src/errors.js` |
| `django` | Python 3.12 + Django 5.2 + Django REST Framework 3.15 | `demo.py` | `tests/test_phase1.py`… | `config/settings.py`, `config/urls.py`, one or two apps with `models.py`, `serializers.py`, `views.py`, `urls.py`, `services.py` |
| `fastapi` | Python 3.12 + FastAPI + httpx | `demo.py` | `tests/test_phase1.py`… | `app/main.py`, `app/routers/`, `app/schemas.py` (Pydantic), `app/services/`, `app/repository.py`, `app/errors.py` |
| `spring` | Java 21 + Spring Boot 3.4.1 + Maven, offline | none | `src/test/java/com/debuggym/api/Phase1Test.java`… | `pom.xml` (exactly `docker/spring-template/pom.xml`), `src/main/java/com/debuggym/api/` with `controller/`, `service/`, `repository/`, `model/`, `dto/`, `exception/` |

Rules on top of the general ones above:

- **Only what the image has.** Express: `express` and Node's standard library (tests use `node:test`, `node:assert/strict`, and `fetch` against `app.listen(0)`). Django: Django + DRF, SQLite in memory. FastAPI: FastAPI, Pydantic, httpx/`TestClient`. Spring: `spring-boot-starter-web`, `-validation` and `-test` only; no JPA, so repositories are in-memory classes (for example a `ConcurrentHashMap` wrapped in a `@Repository`). Spring projects must use the template `pom.xml` unchanged and the package `com.debuggym.api`.
- **The app must not listen on import.** Express exports the app from `src/app.js` and only `src/server.js` calls `listen`. Tests start it on port 0 and close it. FastAPI and Django tests use the framework's test client.
- **Django test base.** Ship `tests/__init__.py` and a read-only-in-spirit `tests/base.py` that sets `DJANGO_SETTINGS_MODULE`, calls `django.setup()`, `setup_test_environment()` and `call_command("migrate", run_syncdb=True, verbosity=0)`, and defines `ApiTestCase(unittest.TestCase)` with an `APIClient` in `setUp` and a transaction rolled back in `tearDown`. Count queries with `django.test.utils.CaptureQueriesContext(connection)`. Use `DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}`, and either ship migrations or rely on `run_syncdb` with apps that have no migrations folder.
- **Spring tests** are JUnit 5 classes named `Phase1Test`, `Phase2Test`, `Phase3Test` in `com.debuggym.api`, using `@SpringBootTest` + `@AutoConfigureMockMvc` and `MockMvc`. Keep the test count modest: each run compiles the project and starts a Spring context (about 5–10 seconds).
- **Phases for an API.** Phase 1 (`bug`): a real-looking defect a user would report: a wrong status code, a validation gap, an off-by-one in pagination, a mutable default shared across requests, middleware in the wrong order, a missing 404. Phase 2 (`feature`): a new endpoint or capability across the layers (route → controller → service → store), for example filtering + pagination + sorting, an action endpoint with business rules, or role checks. Phase 3 (`optimize`): make it production-ready: idempotency keys, concurrency safety, an index or cache that keeps a hot endpoint fast under a large seeded dataset, or removing N+1 queries (assert the query count in Django). Phase-3 tests must fail on the straightforward phase-2 solution.
- **Status codes and error shapes are part of the contract.** State them in the README and the phase instructions (for example `422` with `{"error": {"code": "validation_error", "fields": {...}}}`), and test them.
- Validate with `node scripts/validate-problems.mjs <id>`; it runs every stage in the stack's Docker image (Docker must be running).
