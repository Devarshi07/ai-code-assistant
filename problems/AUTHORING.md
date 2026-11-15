# Authoring structured AI-coding problems

Each structured problem is a small, realistic multi-file codebase worked through in **three phases** inside one ~45-minute session. This mirrors the AI-enabled coding interview format: fix a bug in unfamiliar code, implement a core feature with an AI assistant, then make the solution scale.

| Phase | `kind` | What the candidate does |
| --- | --- | --- |
| 1 | `bug` | Read the codebase, find and fix a planted bug. Typical bugs are non-algorithmic: off-by-one, wrong comparison, wrong type/rounding, shared mutable state, missing visited set, swapped coordinates, wrong default. |
| 2 | `feature` | Implement the primary algorithm or feature, usually where the codebase has a stub. Harder than a LeetCode medium, about 60–150 lines of candidate code. |
| 3 | `optimize` | Larger inputs or tighter limits break a straightforward phase-2 solution. The candidate picks a better algorithm or data structure. |

Every problem ships in **Python** and **JavaScript** with equivalent behavior.

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
