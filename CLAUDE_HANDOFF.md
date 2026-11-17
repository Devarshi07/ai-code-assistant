# Guided-problem language expansion: status

## Goal

Allow choosing a language on restart and switching languages mid-session, with
Python, JavaScript, TypeScript, Java and Go available for every one of the 13
guided algorithm problems.

## Status (2026-11-16): done

All 13 guided problems list all five languages in `problem.json`, and the app
offers them.

- **Ports:** the 18 missing ports were written for `connect-four`, `kitchen-orders`,
  `maximize-unique-characters`, `nonogram-solver`, `task-scheduler` and
  `word-container` (TypeScript, Java and Go each: starter, phase overlays, tests and
  all three solution overlays). The 15 saved ports were finished.
- **Text:** every per-language field (`overview`, `instructions`, `hints`, `answer`)
  has a `typescript`, `java` and `go` entry with that language's paths and
  identifiers. Friend Recommender, Route Planner and Spell Checker got theirs in this
  pass.
- **Timing:** `scripts/measure-phase3.mjs` reports the timed part of each phase-3 test
  (the validator only reports whole-test times) and, with `--untimed`, checks that the
  plain phase-2 solution produces the expected values. Three limits were changed after
  quiet-machine measurements:
  - Spell Checker, Go: 1 s → 500 ms.
  - Kitchen Orders: TypeScript 900 → 750 ms, Java 1100 → 900 ms, Go 700 → 550 ms.
  - Inventory Packer, Go: 250 → 350 ms.

  Measured on this machine, every timed port's optimized solution uses at most a
  fifth of its limit. Every phase-2 solution takes at least 3.4 times its limit;
  Friend Recommender in Java (2.75 s against 800 ms) is the lowest.
- **Restart and switching**, checked through the API and the UI:
  - The timer is unchanged on a switch and fresh on a restart.
  - The draft comes back on a same-phase switch, and the reference fix comes back
    after a passed phase but not after a skipped one.
  - The read-only tests and the Changes baseline are correct.
  - A new assistant chat opens, and the old pending tool approvals are cancelled.
  - JavaScript tests run in the browser after a switch.
- `npm test`: 96 passed, 0 failed.

## Validation evidence

- Every new port passed `node scripts/validate-problems.mjs <id> --lang=typescript,java,go`
  at least once, while other ports were being validated in parallel.
- Kitchen Orders and Spell Checker passed a full five-language validator run after
  their limits changed.
- Quiet-machine measurements covered card-game, connect-four, friend-recommender,
  inventory-packer, kitchen-orders, maximize-unique-characters, maze-solver,
  nonogram-solver, route-planner and spell-checker.

## Known limitations

- The `--untimed` cross-check can't patch tests that check time inside a loop (Card
  Game, Connect Four in TypeScript and Java). Those ports pass the validator and their
  Go cross-checks pass.
- Word Container in Go strips accents with a table of Latin accents and ligatures (Go
  has no Unicode decomposition in the standard library). The table covers the data
  files and tests, but not the full NFKD set.
- Connect Four's `debrief` strings name the Python identifiers (`choose_move`,
  `solve`), as they did before.
- `/api/practice/file/create` still rejects `.ts` and `.go`. The UI uses
  `/api/ws/file/create`, which accepts them.

## Useful commands

```sh
npm test
node scripts/validate-problems.mjs <problem-id> --lang=typescript,java,go
node scripts/measure-phase3.mjs <problem-id> --untimed
node scripts/validate-problems.mjs
```
