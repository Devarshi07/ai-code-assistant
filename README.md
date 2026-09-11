# Debug Gym

A local AI-assisted debugging interview practice workspace. No npm dependencies. Requires Node.js 22+, Git, Docker Desktop with Linux containers, and Ollama.

Debug Gym is for candidates practicing how to investigate an unfamiliar repository, use imperfect AI assistance, implement a small change, and explain their reasoning. It opens directly into a working practice interface rather than a marketing page.

For the full development history, decisions, verified results, and remaining work, read [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

## Quick start

### Prerequisites

| Requirement | Purpose |
| --- | --- |
| Node.js 22 or later | Runs the local web server and automated tests |
| Git | Imports public repositories and historical task commits |
| Docker Desktop with Linux containers | Executes candidate code in disposable containers |
| WSL 2 on Windows | Supplies Docker's Linux backend |
| Ollama | Serves the two local language models |

Install the prerequisites from their official sources: [Node.js](https://nodejs.org/), [Git](https://git-scm.com/), [Docker Desktop](https://www.docker.com/products/docker-desktop/), and [Ollama](https://ollama.com/download). Start Docker Desktop and Ollama before running an interview. If `ollama` is not found after installation, reopen your terminal.

Clone the project:

```sh
git clone https://github.com/Devarshi07/ai-code-assistant.git
cd ai-code-assistant
```

Download the models once:

```sh
ollama pull qwen2.5-coder:0.5b
ollama pull qwen2.5-coder:3b
```

Start the app:

```powershell
npm start
```

Open http://127.0.0.1:3210. Start Ollama and Docker Desktop first. Download the assistant once with `ollama pull qwen2.5-coder:0.5b`. The app downloads Docker images on demand.

There is no `npm install` or frontend build step: the app uses Node's standard library and authored browser assets in `dist/`. The directory name `dist` does not mean those files should be regenerated or excluded from Git.

Use **Local setup** to check Docker, Ollama, and model readiness. Both models can also be downloaded through that dialog while Ollama is running.

### Configuration

| Setting | Default | How to change it |
| --- | --- | --- |
| App address | `http://127.0.0.1:3210` | Set the `PORT` environment variable before startup |
| Ollama API | `http://127.0.0.1:11434` | Currently defined in `server.mjs` |
| Coding helper | `qwen2.5-coder:0.5b` | Currently defined in `server.mjs` |
| Interviewer | `qwen2.5-coder:3b` | Currently defined in `interview.mjs` |

For example, in PowerShell:

```powershell
$env:PORT = '3211'
npm start
```

The smoke-test scripts target port 3210. Use the default port when running them unchanged.

## Models and their roles

| Model | Role | Context budget |
| --- | --- | --- |
| Qwen2.5 Coder 0.5B | Intentionally limited coding copilot; the candidate must verify suggestions | 4,096 tokens |
| Qwen2.5 Coder 3B | Interview conversation, hints, and follow-up exercise suggestions | 8,192 tokens |

Model downloads observed during setup were approximately 397 MB and 1.9 GB respectively. These are download sizes, not total RAM or disk requirements. Docker environments can be much larger. Neither model has direct tools to modify source or execute tests; those actions belong to the candidate and the application.

## Practice modes

- Two small built-in JavaScript incidents and a Python pricing incident with intentionally failing tests.
- Random real-world tasks from [SWE-bench Multilingual](https://www.swebench.com/multilingual.html), fetched through the public Hugging Face dataset API. Filters support language and pre-2021 tasks. Selections are remembered across restarts and cycle after exhaustion. This is a finite catalog, not an infinite generator. The catalog refreshes after seven days.
- Public GitHub repository search and import, including large/archived repositories. These imports require you to select an issue and provide a suitable test command and dependencies.

Random tasks check out their exact `base_commit` before the original fix. Reference solution patches and hints are discarded; the candidate receives the issue description and source. The task's prepared SWE-bench image and evaluation script supply the regression environment. Tasks include both bugs and feature requests. Upstream images may be large, unavailable, or require more resources than the default 4 GB/15-minute limit. The output is not an official SWE-bench score: inspect the individual test results. Some upstream evaluation scripts exit successfully even when tests fail.

The catalog fetched during development contained **300 tasks, nine languages, and 41 distinct repository names**. The upstream overview describes 42 repositories; the count of 41 is what the fetched rows contained. Treat these as an observed snapshot rather than a permanent API guarantee.

### Typical practice flow

1. Start a short exercise, choose a random historical task, or import a GitHub URL.
2. Read the incident brief and repository README.
3. Use the explorer's path filter to find source and test files.
4. Run a baseline test command and inspect the actual output.
5. Edit and save source, or use **New file** to add a module or regression test.
6. Ask the small copilot for a second opinion and verify its advice.
7. Rerun tests and explain what changed and why.

The editor supports Tab indentation and Ctrl/Cmd+S. Switching files saves pending edits; tests and copilot questions also save the open file before using it. New files may include nested relative paths such as `src/discount-policy.js`.

## Languages

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

## 45-minute interview mode

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

### How feedback is grounded

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
- Repository code runs only in Docker with networking disabled, dropped capabilities, no-new-privileges, and CPU/memory/PID/time limits. Host repositories are mounted read-only. Generic commands run in temporary writable copies; benchmark commands run in disposable writable containers.
- No host shell execution of repository scripts. Git imports don't initialize submodules or LFS objects. Projects needing these need additional preparation.
- Sessions persist under `.sessions/`. The slim task catalog and selection history live in `.task-cache/`. Runtime images persist in Docker. These can consume significant disk space over repeated sessions; no automatic deletion is performed.
- The explorer indexes up to 20,000 files, 24 directory levels, and 150 KB per text file. Filter by path to browse large repositories. Dotfiles, symlinks, dependency folders, and binary files are excluded. The copilot sees only the selected saved file, task brief, and recent test output, within a 4K context budget.
- Docker isolation is suitable for personal practice; it is not a production multi-tenant security boundary. Treat untrusted code and upstream images accordingly.

## Verification

`npm test` checks task selection and solution exclusion, path restrictions, runtime inference, and confirms that built-in exercises fail before and pass after a repair. `node scripts/smoke.mjs` checks the running local app and optionally live Docker/Ollama integration.

```sh
# Automated checks; no model download or running app required
npm test

# Start the app in another terminal before these live checks
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
| `server.mjs` | HTTP routes, session files, imports, model requests, Docker jobs, path checks |
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

This is a local single-user MVP. It is not a hosted multi-user interview platform. Public GitHub imports do not automatically identify a suitable bug; curated historical tasks provide the concrete issue. The task pool is finite and can repeat after exhaustion. Large codebases are supported within explorer and resource limits, not without limits.

There is no integrated repository-wide semantic retrieval, guaranteed benchmark scoring, automatic feature-test generation, terminal emulator, fully local speech transcription, session cleanup UI, or production authentication. These are possible future improvements, not implemented capabilities.

## Licensing and attribution

SWE-bench Multilingual is provided under its upstream dataset license; cloned repositories retain their own licenses. See [the dataset card](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual).

This project does not currently include its own `LICENSE` file. A repository license should be chosen before presenting this project's code as freely reusable under a specific license. Model and container images retain their respective upstream terms.
