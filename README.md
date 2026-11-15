# Debug Gym

A local practice environment for **AI-enabled coding interviews**, the round where you get a real multi-file codebase and an AI assistant, then fix a bug, build a feature and make it scale while staying in control of the AI. No npm dependencies, no cloud services: Node.js 22+, Ollama for the AI, and Docker Desktop for Python sandboxes.

It follows the format of AI-enabled interviews (a CoderPad-style environment with a file explorer, editor and AI chat) and the practice structure popularised by interview-prep platforms. All content is original.

| Mode | What you do |
| --- | --- |
| **AI Coding: Structured** | 13 in-browser problems (3 Easy, 6 Medium, 4 Hard), each in Python or JavaScript, in 45 minutes. Phase 1 fixes a bug, phase 2 builds the core feature, and phase 3 optimizes against stricter tests. You get an AI assistant, provided tests, hints, a debrief and a graded report. |
| **AI Coding: Open-ended** | A starter project on your own machine. Build a small service in your own editor with your own AI tools, then submit your code and AI transcript. Hidden acceptance tests run, you answer questions generated from your code, and you get a verdict. |
| **Real-world repos** | The original mode: SWE-bench Multilingual tasks, GitHub imports, a deliberately small 0.5B copilot and a voice-capable 45-minute mock interviewer. |

For the development history and earlier decisions, see [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

## Quick start

| Requirement | Needed for |
| --- | --- |
| Node.js 22 or later | Everything |
| [Ollama](https://ollama.com/download) and a chat model | The AI assistant and AI feedback (the app still works without it) |
| Docker Desktop (WSL 2 on Windows) | Python sessions and real-world repos. JavaScript sessions run in your browser. |
| Git | Real-world repos only |

```sh
git clone https://github.com/Devarshi07/ai-code-assistant.git
cd ai-code-assistant
ollama pull qwen3:8b
npm start
```

Open http://127.0.0.1:3210. There's no `npm install` or build step; the browser assets in `dist/` are authored by hand. **Local setup** in the top bar shows what is running and which models were picked.

Any installed Ollama chat model appears in the assistant's model picker. The app prefers `qwen3:8b`, then `qwen3.5:9b` and other 7–14B coders for the assistant, and `qwen3.5:9b` then `qwen3:8b` for reviews. Override with environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3210` | App port (smoke scripts assume 3210) |
| `DG_ASSISTANT_MODEL` | first available from the preference list | Default assistant model |
| `DG_REVIEW_MODEL` | first available from the preference list | Model that writes feedback and debrief questions |
| `DG_OPEN_DIR` | `~/debug-gym-practice` | Where open-ended starter projects are created |

## AI Coding: structured practice

1. **Choose a problem and a language.** The 45-minute timer starts when you press Start. Python needs Docker; JavaScript doesn't.
2. **The workspace** has a file explorer, an editor with tabs, syntax highlighting, auto-indent, Tab/Shift+Tab, Ctrl+/ comments and resizable panes, plus a Tests/Output panel and a right-hand panel with **Instructions** and the **AI Assistant**.
3. **Run** with the Run button, **Ctrl+Enter**, or **Ctrl+S** (save and run, like CoderPad). The dropdown switches between the test suite and `main.py`/`main.js`. Results are grouped by phase, with failure messages and stack traces.
4. **Phases unlock progressively.** When every phase-N test passes, *Continue to phase N+1* adds the next phase's tests and instructions. You can skip a phase, and the skip is recorded. Provided tests are read-only and always run in their original form. Add your own tests in files like `tests/test_custom.py` or `tests/custom.test.js`; they run alongside.
5. **The assistant** streams answers from your local model. It reads your project files, the current phase and your latest run. Like interview assistants, it can't edit files or run code: you paste its suggestions and run the tests. Code blocks have a Copy button.
6. **Submit** (or run out of time), answer three debrief questions, and get a report.

Every problem's answer key (root cause, approach, complexity, and reference solutions for each phase) is available from the problem list and the report.

### How sessions are graded

The report scores the four areas AI-enabled interviews evaluate: **problem solving**, **control over the AI**, **verification**, and **communication**. Each is scored from 1 to 4, and the average maps to a practice verdict: Strong Hire, Hire, Lean Hire, Lean No Hire or No Hire.

Scores are bounded by recorded evidence before any AI is involved. The app records phases passed and skipped, test runs, hints, prompts (including whether they name real files and functions, and whether you pasted the problem statement into the AI), pastes of AI code into the editor and whether a test run followed each one, lines changed, and your debrief answers. For example, no test runs caps verification at 1, and pasting the instructions into the AI caps control at 2. The local reviewer model writes the narrative and may move each score at most one level from the evidence baseline. Without a model, the bounds alone produce a rule-based report. This is practice feedback, not a hiring decision.

### Problems

| Difficulty | Problems |
| --- | --- |
| Easy | Battleship, Inventory Packer, Spell Checker |
| Medium | Card Game, Friend Recommender, Maze Solver, Route Planner, Task Scheduler, Word Container |
| Hard | Connect Four, Kitchen Orders, Maximize Unique Characters, Nonogram Solver |

Each problem is a believable codebase of 300–580 lines with a README. `node scripts/validate-problems.mjs` checks every one: the starter fails phase 1, each reference fix unlocks the next stage, the straightforward phase-2 solution fails phase 3, and the final solution passes everything. To add problems, see [problems/AUTHORING.md](problems/AUTHORING.md).

## AI Coding: open-ended practice

Choose a task, and the app writes a starter project to `~/debug-gym-practice/<task>-<language>-<time>` (README brief, interface stubs and a few provided tests), then shows commands to open it and run the tests. Work in your own editor with whatever AI tools you like. When you submit, the app snapshots the folder (text files only, with size limits) and takes your pasted AI transcript. It then runs the provided tests, the hidden acceptance tests and your own tests: in Docker for Python, in the browser for JavaScript. A local model asks three questions about your submission. The report adds code-quality notes to the four areas, and hidden-test results bound the problem-solving score. Tasks live in `open-tasks/`; see [open-tasks/AUTHORING.md](open-tasks/AUTHORING.md).

## Real-world repo practice

The original Debug Gym mode remains under **Real-world repos**. It uses a deliberately limited copilot (`ollama pull qwen2.5-coder:0.5b`) and a 3B interviewer (`ollama pull qwen2.5-coder:3b`). Both can be downloaded from Local setup.

- Two small built-in JavaScript incidents and a Python pricing incident with intentionally failing tests.
- Random real-world tasks from [SWE-bench Multilingual](https://www.swebench.com/multilingual.html), checked out at their exact `base_commit`, with reference patches and hints discarded. The catalog fetched during development contained 300 tasks in nine languages. Benchmark script completion is not an official SWE-bench score; inspect the individual results.
- Public GitHub repository search and import. You choose the issue and the test command.

### Repo languages

16 presets: JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, R, Elixir, Perl, and Bash. Presets provide toolchains, not every project's dependencies. TypeScript uses Node 24's native type stripping; projects requiring full TypeScript compilation need a prepared image. Generic commands are editable and a custom prebuilt image can be supplied. Random benchmark tasks cover the nine languages in that dataset and use its own historical environment.

| Language | Preset image | Default test approach |
| --- | --- | --- |
| JavaScript | `node:22-alpine` | `node --test` |
| TypeScript | `node:24-alpine` | Node native tests/type stripping |
| Python | `python:3.12-slim` | `unittest discover` |
| Java | `maven:3.9-eclipse-temurin-21` | Maven offline tests |
| C | `gcc:14` | `make test` |
| C++ | `gcc:14` | `make test` |
| C# | `mcr.microsoft.com/dotnet/sdk:8.0` | `dotnet test --no-restore` |
| Go | `golang:1.24` | `go test ./...` |
| Rust | `rust:1` | `cargo test --offline` |
| Ruby | `ruby:3.3` | Discover `test/**/*_test.rb` |
| PHP | `php:8.3-cli` | `vendor/bin/phpunit` |
| Swift | `swift:6.0` | `swift test --skip-update` |
| R | `r-base:4.4.3` | `testthat::test_dir` |
| Elixir | `elixir:1.18` | `mix test --no-deps-check` |
| Perl | `perl:5.40` | `prove -r t` |
| Bash | `bash:5.2` | `bash test.sh` |

These are presets, not a claim that every repository or every image has been verified. For example, PHPUnit, testthat, third-party packages, and repository-specific build tools must already exist in a prepared image. Network access is disabled during test execution.

The historical task library covers C, C++, Go, Java, JavaScript, TypeScript, PHP, Ruby, and Rust. Python is available through the short exercise and manual imports. Other preset languages can be used by importing a codebase and starting an interview from its workspace.

### 45-minute interview mode

Download the separate interviewer with `ollama pull qwen2.5-coder:3b`. Use **Set up an interview** to choose a language/codebase, or start an interview from any existing workspace. The environment is prepared before the clock starts. The interviewer uses a stronger 3B model; the original copilot remains 0.5B. These are local language models, not human-equivalent interview assessors.

The server persists a 45-minute deadline, transcript, hint count, edited filenames, copilot usage, and recent test output. Reloading does not reset the timer. The candidate can request progressive hints or move to feature work early. Feature criteria remain visible in the interviewer window. The LLD discussion covers interfaces, responsibilities, cohesion/coupling, dependency injection, testability, and tradeoffs.

| Time | Focus |
| --- | --- |
| 0–5 minutes | Understand requirements and expected behavior |
| 5–22 minutes | Reproduce, debug, repair, and verify |
| 22–35 minutes | Implement a small feature extension |
| 35–42 minutes | Discuss low-level design and tradeoffs |
| 42–45 minutes | Explain the result and reflect |

Short exercises have explicit feature assignments: a maximum-discount cap for pricing and a live-entry `size()` method for the cache. Other codebases use model-proposed extensions, which should be reviewed for feasibility and duplication of existing functionality.

At the deadline, the active page requests feedback automatically. If the page is closed, the server still refuses further interview work after the deadline and feedback is requested when the session is reopened. Finish or Give up ends early. Feedback covers debugging, implementation, testing, LLD, and communication, grounded in the transcript, saved selected file, and observed actions. Unobserved areas should not be rated. If the model is unavailable, the app returns an explicitly unscored observations report. Reports and transcripts can be downloaded as JSON; previous interview records are retained in the session directory when a new interview starts.

#### How interview feedback is grounded

The small model produced unsupported judgments during development, so the report deliberately separates **recorded evidence** from **AI suggestions**:

- Candidate answers are tracked separately from interviewer messages and button-triggered requests.
- Discussion evidence quotes the candidate's own submitted words.
- Saved edits and command results are reported as observations, not proof of correctness.
- Missing implementation or test evidence is marked **Not observed**.
- The model suggests three future exercises: debugging/testing, feature implementation, and LLD.
- No overall skill score, hiring recommendation, or human-equivalent assessment is produced.

Discussion categorization uses simple text matching and can miss or misclassify a topic. Feature completion is not independently graded. Review the evidence and recommendations yourself.

Voice uses browser SpeechRecognition for dictation and SpeechSynthesis for playback. The user reviews and sends recognized text; the model receives text, not raw audio. Microphone support depends on the browser and permission. Recognition may send audio to the browser provider's online service; it is **not guaranteed local/offline**. Browsers without recognition can use text answers. Actual microphone capture requires user permission and is not exercised by automated backend tests.

## Execution and storage

- Loopback-only HTTP service with Host/Origin checks. Designed for a single local user, not deployment as a public multi-user service.
- Structured and open-ended **JavaScript** runs in a dedicated Web Worker. The worker script is served with a Content-Security-Policy of `default-src 'none'`, which blocks network requests. It has a CommonJS loader and `node:test`/`node:assert` shims (`dist/runner-core.js`), and runs are abandoned after 30 seconds (60 for open-ended submissions). **Python** runs in a `python:3.12-slim` container with no network, read-only mounts, dropped capabilities and CPU, memory, PID and time limits. The harness (`harness/pyrunner.py`) reports structured per-test results and aborts any single test after 12 s.
- Provided tests are stored separately per session and copied over the candidate's files before every run, so editing them can't change a result.
- Repository code runs only in Docker with networking disabled, dropped capabilities, no-new-privileges, and CPU/memory/PID/time limits. Host repositories are mounted read-only. Generic commands run in temporary writable copies; benchmark commands run in disposable writable containers.
- No host shell execution of repository scripts. Git imports don't initialize submodules or LFS objects. Projects needing these need additional preparation.
- Sessions persist under `.sessions/`. The slim task catalog and selection history live in `.task-cache/`. Runtime images persist in Docker. These can consume significant disk space over repeated sessions; no automatic deletion is performed.
- The explorer indexes up to 20,000 files, 24 directory levels, and 150 KB per text file. Filter by path to browse large repositories. Dotfiles, symlinks, dependency folders, and binary files are excluded. The copilot sees only the selected saved file, task brief, and recent test output, within a 4K context budget.
- Docker isolation is suitable for personal practice; it is not a production multi-tenant security boundary. Treat untrusted code and upstream images accordingly.

## Verification

`npm test` runs 25 automated checks: the in-browser runner, the problem catalog, the practice session lifecycle (canonical tests, phase unlocking, hints, timeouts, debrief), evidence summaries, prompt signals, review bounds and clamping, open-ended bounds, task selection, path restrictions and the built-in exercises. `npm run validate` runs every structured problem and open-ended task end to end in both languages.

```sh
# Automated checks; no model download or running app required
npm test
npm run validate

# Start the app in another terminal before these live checks
node scripts/practice-smoke.mjs python      # full structured session through the API (Docker)
node scripts/practice-smoke.mjs javascript
node scripts/smoke.mjs
node scripts/smoke.mjs --tasks
node scripts/python-smoke.mjs
node scripts/interview-smoke.mjs
```

Live scripts create local practice sessions, may download runtime images, and use installed models. `--tasks` also fetches/imports a historical repository. They do not test the microphone or browser layout.

Verified during development:

- All **14 automated tests** passed.
- JavaScript Docker exercise failed before repair and passed all four tests afterward.
- Python Docker exercise failed before repair and passed all three tests afterward.
- A historical Preact task imported at its recorded base commit.
- Both local models responded through the app.
- Interview conversation, hints, explicit feature criteria, feedback generation, and return to free practice worked through live API checks.
- The new-file API created a nested source module.

Not comprehensively verified: all 16 runtime images, all benchmark test suites, browser visual behavior, microphone capture, or offline speech support.

## Architecture and source map

```text
Browser UI ──HTTP──> Node.js local server
                       ├── Git / public GitHub API
                       ├── Hugging Face task API and local catalog cache
                       ├── Ollama on localhost:11434
                       └── Docker CLI → disposable test containers
```

| File or directory | Responsibility |
| --- | --- |
| `server.mjs` | HTTP server, static assets and CSP, repo-practice routes, jobs, Docker and Ollama helpers |
| `problems.mjs` | Loads and validates structured problems; overlays, localisation, canonical tests |
| `practice.mjs` | Structured session state: phases, canonical tests, runs, hints, evidence, assistant context |
| `practice-routes.mjs` | Structured-practice HTTP routes and the streaming assistant |
| `practice-review.mjs` | Evidence bounds, the local-model review, verdicts and diffs |
| `open-ended.mjs` | Open-ended tasks: workspaces, snapshots, hidden tests, debrief questions, review |
| `sandbox.mjs` | Python Docker sandbox and result parsing |
| `harness/pyrunner.py` | Python test/main runner with structured results and per-test timeouts |
| `problems/`, `open-tasks/` | Problem and task content, with authoring guides |
| `dist/practice.js`, `dist/workspace.js` | Library, start dialog, answer key, history and guide pages; the timed IDE workspace |
| `dist/editor.js`, `dist/markdown.js` | Code editor; syntax highlighting and safe markdown |
| `dist/runner-core.js`, `dist/runner-worker.js` | In-browser JavaScript runner, also used by the validators |
| `dist/open-ended.js`, `dist/report.js` | Open-ended pages; shared report components |
| `interview.mjs` | Deadline, conversation, evidence tracking, feature assignment, reports |
| `task-source.mjs` | Public task catalog, solution exclusion, filtering, random selection |
| `runtimes.mjs` | Language presets and runtime inference |
| `challenges.mjs` | Built-in broken exercises and their feature requirements |
| `dist/index.html` | Main app structure |
| `dist/app.js` | Editor, explorer, imports, test output, copilot |
| `dist/interview-ui.js` | Interview window, voice controls, timer, report interface |
| `dist/style.css` | App styles and responsive layouts |
| `tests/` | Automated correctness and boundary checks |
| `scripts/` | Live integration smoke checks |

There is no database, cloud LLM dependency, account system, npm package dependency, or separate frontend development server. GitHub and Hugging Face access is used for discovery/import, Docker downloads images, and Ollama downloads model weights.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| App will not start | Check Node version and whether port 3210 is occupied |
| Docker is unavailable | Start Docker Desktop, use Linux containers, and check WSL 2 on Windows |
| Model missing | Start Ollama and pull the exact model tag listed above |
| First run takes a long time | Check whether a model or Docker image is downloading; large environments are expected to take longer |
| Dependencies are missing | Supply an image containing the project's required packages; runtime test containers have no network |
| GitHub search fails | Public API rate limiting may apply; paste a repository URL directly |
| Historical checkout fails | Check remote commit availability, network access, and platform-specific filenames; Git long paths are enabled for imports |
| No microphone control | Use text answers or a browser with SpeechRecognition support; microphone permission is required |
| Feedback is unscored | No relevant evidence was recorded, or the model could not produce the follow-up plan |
| Disk usage grows | Sessions, task cache, model weights, and Docker images persist; the app does not automatically prune them |

## Current scope and limitations

This is a local single-user practice tool. It is not a hosted multi-user interview platform, and its local-model feedback is practice guidance, not an assessment by a human interviewer. Phase-3 time limits were calibrated on a Ryzen 5 7500X3D. On much slower machines, limits may need loosening in the problem tests. On Windows hosts the Python per-test timeout only applies inside Docker (the validator relies on its own run timeout). Public GitHub imports do not automatically identify a suitable bug; curated historical tasks provide the concrete issue. The task pool is finite and can repeat after exhaustion. Large codebases are supported within explorer and resource limits, not without limits.

There is no integrated repository-wide semantic retrieval, guaranteed benchmark scoring, automatic feature-test generation, terminal emulator, fully local speech transcription, session cleanup UI, or production authentication. These are possible future improvements, not implemented capabilities.

## Licensing and attribution

SWE-bench Multilingual is provided under its upstream dataset license; cloned repositories retain their own licenses. See [the dataset card](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual).

This project does not currently include its own `LICENSE` file. A repository license should be chosen before presenting this project's code as freely reusable under a specific license. Model and container images retain their respective upstream terms.
