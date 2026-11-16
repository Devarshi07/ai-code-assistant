# Continue the guided-problem language expansion

## Goal

Finish the user's request: allow choosing a language on restart and switching
languages mid-session, with Python, JavaScript, TypeScript, Java and Go available
for every one of the 13 guided algorithm problems.

Continue from branch `hackerrank-oa-upgrade`. Read the current files before
editing. This checkpoint also contains earlier app upgrades and new content;
preserve those changes and existing user sessions.

## Why the previous work stopped

Claude's local task logs show that all seven porting agents eventually stopped
because of the five-hour usage limit (HTTP 429). Their saved files remain in the
repository. A failed agent notification does not mean its port failed tests.

## Already implemented

- Restart dialogs in the problem lobby and workspace accept a language choice.
- The workspace header and overflow menu offer mid-session switching.
- Switching keeps the timer and phase progress. Each language retains its draft;
  switching back during the same phase restores it. A draft from an earlier
  phase is rebuilt for the current phase.
- The new workspace includes reference fixes only for consecutively completed
  earlier phases starting at phase 1. Skipped phases stay unsolved.
- Canonical tests and the Changes/review baseline follow the selected language.
- The UI opens a new AI chat after switching, and the server cancels pending
  assistant tool approvals from the previous language.
- TypeScript, Java and Go runners, Dockerfiles, result parsing, editor labels
  and test templates exist. Plain Java/Go problems are not classified as API
  projects. The JUnit single-letter-word display-name fix is present.

Do not reimplement these features. Verify them while completing the rollout.

## Current problem status

| Problems | State and next step |
| --- | --- |
| Battleship, Inventory Packer | All five languages are enabled. Their TypeScript, Java and Go ports passed one audit validation run. Finish the full regression and repeated timing checks. |
| Card Game, Maze Solver | All three new ports passed one audit validation run, and per-language metadata is present. Finish repeated timing checks and enable the languages in `problem.json`. |
| Friend Recommender | All three new ports passed one audit validation run. Add the missing per-language overview/instructions/hints/answers, finish timing checks, then enable the languages. |
| Route Planner, Spell Checker | All three port trees exist but are not enabled. Finish reviewing and validating them, complete per-language metadata, calibrate phase-3 performance, then enable them. The audit stopped before validating these two. |

Spell Checker's previous agent was still investigating Java/Go timing margins,
including trie-based alternatives. Do not assume its performance calibration is
finished just because the reference solution passes once.

These six problems have no TypeScript, Java or Go port trees yet (18 ports):

- `connect-four`
- `kitchen-orders`
- `maximize-unique-characters`
- `nonogram-solver`
- `task-scheduler`
- `word-container`

Overall, 6 of the 39 requested new language/problem combinations are enabled;
15 have saved port trees that still need completion or enabling; 18 need authoring.

## Implementation instructions

1. Read `problems/AUTHORING.md`, especially the porting and timing requirements.
2. Reuse and finish the seven existing sets of ports. Keep the scenario, planted
   bug, phase-2 feature, test coverage and phase-3 optimization equivalent to the
   Python/JavaScript versions. Keep identifiers and file paths correct in every
   language's instructions, hints, answers and README.
3. Author the remaining 18 ports, including starter code, demos, phase overlays,
   tests and all three solution overlays.
4. Validate a new language before listing it in `problem.json`. The validator's
   `--lang` option can validate unlisted ports. Use language order:
   `python`, `javascript`, `typescript`, `java`, `go`.
5. Follow the author's required performance margins and three validation runs.
   Run timing-sensitive validation without competing heavy jobs. The
   straightforward phase-2 solution must fail phase 3 for the intended reason;
   the optimized solution must pass with a comfortable margin.
6. Verify restart and switching through the UI across all five languages:
   unchanged timer on switching, fresh timer on restart, same-phase draft
   restoration, skipped-phase behavior, correct read-only tests, correct Changes
   baseline, new assistant chat, and cancellation of old pending tool approvals.
   Use disposable attempts and preserve the user's existing attempts.
7. Update the README to describe the final language coverage and switching
   behavior, then run the automated tests and complete content validation.
8. Summarize the finished work, checks performed and any unresolved failures.

Useful commands:

```sh
npm test
node scripts/validate-problems.mjs <problem-id> --lang=typescript,java,go
node scripts/validate-problems.mjs
```

## Audit evidence and limits (2026-11-16)

- `npm test`: 96 passed, 0 failed. The earlier conversation's 100-test claim was
  not reproduced; 96 is the observed current count.
- All 21 current problem definitions passed schema validation.
- The five problems marked as passing above were checked through the validator's
  stages and final demo for all three new languages, once each. This does not
  replace the required repeated performance checks or full regression run.
- Isolated route checks confirmed switching through all five languages preserves
  the deadline, and restarting into TypeScript, Go and Java works.
- The actual workspace file-creation endpoint accepts `.ts` and `.go` files.
  The older `/api/practice/file/create` endpoint has an outdated extension list,
  but the current UI uses `/api/ws/file/create`; do not mistake this for a broken
  New File button.
- The running app exposed the new languages only for Battleship and Inventory
  Packer at audit time.
- The audit did not repeat Claude's earlier browser walkthrough. Final UI
  verification remains necessary.
