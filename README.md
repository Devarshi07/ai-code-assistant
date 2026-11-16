# Debug Gym

A local practice environment for **AI-assisted coding interviews**. It recreates the three formats you are likely to meet: assessment-style coding questions with an AI assistant beside the editor, multi-file **code repos** in an AI-assisted development environment with an agent you direct and approve, and **mock interviews** with an AI interviewer that end in a scored report. No npm dependencies and no cloud services: Node.js 22+, Ollama for the AI, and Docker Desktop for code execution.

The layouts and workflows follow the conventions of current AI-assisted interview platforms. Debug Gym is an independent practice tool, not affiliated with any of them, and all questions, problems and text are original.

| Area | What you do |
| --- | --- |
| **Coding questions** | 24 single-file problems (Easy, Medium, Hard) in Python, JavaScript, Java, C++ and Go. A starter template reads stdin and prints to stdout; you complete the function. **Run Code** runs the sample tests or your custom input, **Submit Code** runs every test case including hidden ones and scores you. An AI assistant beside the editor sees the statement and your code. |
| **Code repos** | A workspace with a file tree, Monaco editor, Diff, Terminal and Tests, plus an AI assistant with **Ask**, **Plan** and **Agent** modes. The agent reads and searches files, edits them, runs commands and runs the tests, and each change waits for your approval. Choose a guided three-phase problem (13, timed, with a debrief and a graded review), a real issue from SWE-bench (800 tasks in 10 languages), a short incident, any public GitHub repository, or a take-home task in your own editor. |
| **Practice tests** | Full timed assessments that behave like real online tests: a landing page and onboarding, **Test home**, a question list, **Run Code / Run Tests / Save & Proceed**, a countdown that never pauses, multiple-choice and written-answer questions, integrity checks (tab tracking, Secure mode, Proctored) and **Submit Test**. Ready-made tests, a sample test and a custom-test builder; a report shows what would have been scored. |
| **Mock interviews** | A **coding interview** with an AI interviewer (text or voice) and a code editor; **technical screen**, **system design** (with a notes pane), **behavioural** and **AI fluency** conversation interviews; and an **AI-assisted repo interview** where you solve a guided repo with the agent while the interviewer watches. Each ends with scores, an overall recommendation and a 15-minute follow-up conversation about the feedback. |

For the development history and earlier decisions, see [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

## Quick start

| Requirement | Needed for |
| --- | --- |
| Node.js 22 or later | Everything |
| [Ollama](https://ollama.com/download) and a chat model with tool support | The assistant, the agent, the interviewer and AI feedback. The app still works without it. |
| Docker Desktop (WSL 2 on Windows) | Running code for coding questions, Python repos, real-world repos and agent commands. Guided JavaScript repos run their tests in the browser. |
| Git | Real-world repos and GitHub imports |

**Set up Docker first.** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/); on Windows, choose the WSL 2 backend and Linux containers. Start it and wait until it reports that the engine is running, then check from a terminal:

```sh
docker info   # should print server details, not "Cannot connect to the Docker daemon"
```

Docker Desktop has to be running whenever you use the app. You don't need to pull images yourself: the app downloads each one the first time it's needed, so the first run in a language can take a few minutes. Coding questions use `python:3.12-slim`, `node:22-alpine`, `eclipse-temurin:21-jdk-alpine`, `gcc:14` and `golang:1.24-alpine`; Python guided repos use `python:3.12-slim`; other runtime presets and real-world tasks pull their own images, and SWE-bench task images can be several GB. To download the coding-question images ahead of time:

```sh
docker pull python:3.12-slim
docker pull node:22-alpine
docker pull eclipse-temurin:21-jdk-alpine
docker pull gcc:14
docker pull golang:1.24-alpine
```

Then get the code, pull the models and start the app:

```sh
git clone https://github.com/Devarshi07/ai-code-assistant.git
cd ai-code-assistant
ollama pull qwen3:8b
ollama pull qwen2.5-coder:3b   # optional: AI inline suggestions in the editor
npm start
```

Open http://127.0.0.1:3210. There's no `npm install` or build step: the browser code in `dist/` is written by hand, and the Monaco editor is vendored under `dist/vendor/monaco`. **Local setup** in the top bar shows what is running and can download both models.

Any installed Ollama chat model appears in the assistant's model picker. The app prefers `qwen3:8b`, then `qwen3.5:9b` and other 7–14B models for the assistant, agent and interviewer, and `qwen3.5:9b` then `qwen3:8b` for feedback. Inline suggestions use a fill-in-the-middle model such as `qwen2.5-coder:3b`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3210` | App port (the smoke scripts assume 3210) |
| `DG_ASSISTANT_MODEL` | first available from the preference list | Default assistant, agent and interviewer model |
| `DG_REVIEW_MODEL` | first available from the preference list | Model that writes feedback |
| `DG_COMPLETION_MODEL` | first installed `qwen2.5-coder` model | Inline-suggestion model |
| `DG_ASSISTANT_CTX` | 16384 for models of 6B and up, otherwise 8192 | Context window for the assistant |
| `DG_OPEN_DIR` | `~/debug-gym-practice` | Where take-home starter projects are created |

## Coding questions

- **Library:** filter by status, difficulty and skill, or search. Each question shows its difficulty, maximum score (30, 50 or 80) and skills.
- **Workspace:** the problem statement (function description, input format, constraints, output format, samples with explanations) and your submissions on the left; the editor in the middle; the AI assistant on the right (toggle it from the top bar). Panes are resizable.
- **Editor:** Monaco, with a language picker and an **ⓘ** panel (version, time limit and memory limit per language), autosaved drafts per language, reset to template and upload a file. The gear icon sets the **editor mode (Normal, Vim or Emacs)**, theme, tab spaces, font size, word wrap, autocomplete, AI inline suggestions and the minimap, and a status bar shows the cursor position, spaces, autocomplete and mode. **Ctrl+Enter** runs, **Ctrl+Shift+Enter** submits, **Ctrl+Space** opens autocomplete.
- **Results:** a **Test Results** panel with a **Test Cases** tab (all cases, each with its compiler message and verdict: *Success*, *Wrong Answer*, *Runtime Error*, *Terminated due to timeout*, *Compilation error*; plus Input, Your Output, Expected Output and Debug Output) and a **Custom** tab where Run Code runs your own input. *Raw format* shows spaces and line ends. Hidden test cases keep their input and expected output private but show your output and debug output. Time limits are 10 s for Python and JavaScript, 4 s for Java and Go, and 2 s for C++.
- **Score:** the maximum score times the share of weighted test cases passed. Submissions are listed with their score, language and time, and you can reopen their code.
- **AI assistant:** an Ask-mode chat that sees the statement, your current code and your latest run. *Full help* may write code; *Guided help* gives hints, explanations and short snippets only. Code blocks have **Insert** (at the cursor) and **Copy**.

Questions live in `questions/<id>/`; see [questions/AUTHORING.md](questions/AUTHORING.md). `node scripts/validate-questions.mjs` checks each one in all five languages: the samples match their test files, the template fails, the reference solution passes every test, and the slowest test takes at most half the time limit.

## Code repos

### The workspace

| Part | What it does |
| --- | --- |
| Left rail | **Question** (the task, phases, hints) or **Brief**, **Sessions** (saved agent conversations) and, in AI-fluency interviews, **Interviewer** |
| Centre | The AI assistant |
| Right | **Editor** (file tree with filter and change markers, tabs, Monaco), **Diff** (every changed file against the starting code, side by side or inline), **Terminal** (commands in a disposable sandbox copy, with history), **Tests** (results grouped by phase, or the repo's test output and test settings) |

On phones the three areas become tabs at the bottom.

### The AI assistant and agent

- **Ask** answers questions and can list, read and search files and view your changes. **Plan** investigates with the same read-only tools and replies with goal, findings, numbered steps, verification and risks. **Agent** can also `edit_file`, `write_file`, `delete_file`, `run_command` and `run_tests`.
- Every edit, command or test run appears as a **pending tool call** with a diff preview: **Allow** or **Cancel**. You can choose to always allow edits or commands. Read-only tools run without asking.
- **@** attaches context: a file, the problem statement, your changes, the terminal output, the latest test results or your editor selection. **/** opens commands such as `/explain`, `/fix`, `/tests`, `/review`, `/plan` and `/new`.
- **Checkpoints:** each message records the files the agent changes after it. *Restore checkpoint* undoes all of those changes and returns the conversation to just before that message, with your text back in the input box.
- Sessions are saved per workspace. A context meter shows how full the model's context window is; older tool output is trimmed automatically, then the oldest turns.
- Local models sometimes announce an action ("Let's make this change") and stop. The agent loop notices this and asks the model to carry it out, at most twice per message.
- Tool calls use Ollama's native tool calling. The agent works with any installed chat model that supports tools; larger models make better changes, and reviewing what the agent proposes is part of the exercise.

### Guided problems

13 problems (3 Easy, 6 Medium, 4 Hard), each in Python or JavaScript, in 45 minutes:

| Difficulty | Problems |
| --- | --- |
| Easy | Battleship, Inventory Packer, Spell Checker |
| Medium | Card Game, Friend Recommender, Maze Solver, Route Planner, Task Scheduler, Word Container |
| Hard | Connect Four, Kitchen Orders, Maximize Unique Characters, Nonogram Solver |

Phase 1 fixes a bug, phase 2 builds the core feature and phase 3 optimizes against stricter tests. Phases unlock when their tests pass (or when you skip, which is recorded). Provided tests are read-only and run in their original form; add your own as `tests/test_custom.py` or `tests/custom.test.js`. Python runs in Docker; JavaScript runs in the browser, including when the agent asks to run the tests.

Submit (or run out of time), answer three debrief questions, and get a report on **problem solving**, **control over the AI**, **verification** and **communication**, each scored from 1 to 4. Scores are bounded by recorded evidence before any AI is involved: phases passed, test runs, hints, prompts (whether they name real files and functions, whether you pasted the task into the AI), AI code changes (pasted or applied by the agent) and whether a test run followed each one, and your debrief answers. The reviewer model writes the narrative and may move each score at most one level from the evidence baseline. Every problem has an answer key. To add problems, see [problems/AUTHORING.md](problems/AUTHORING.md); `node scripts/validate-problems.mjs` checks them.

### Real-world issues, incidents and your own repos

- **Real-world issues:** random tasks checked out at their exact base commit, with reference patches and hints removed. Python tasks come from [SWE-bench Verified](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified) (500 tasks from projects such as Django, SymPy, scikit-learn, Matplotlib, Sphinx and pytest, each with an estimated fix time); nine other languages come from [SWE-bench Multilingual](https://www.swebench.com/multilingual.html) (300 tasks). **Run tests** runs the task's regression tests in its own environment image, which can be several GB the first time. The terminal runs in the same image at `/testbed`. A passing run is not an official SWE-bench score.
- **Quick incidents:** small JavaScript and Python codebases with failing tests.
- **Your own repo:** import or search public GitHub repositories. Set the runtime, test command and image in the Tests tab; the agent uses the same settings.
- **Take-home:** a starter project on your own machine for your own editor and AI tools. You submit the code and your AI transcript, hidden acceptance tests run, a local model asks three questions about your submission, and you get a report. Tasks live in `open-tasks/`; see [open-tasks/AUTHORING.md](open-tasks/AUTHORING.md).

16 runtime presets cover JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, R, Elixir, Perl and Bash (see `runtimes.mjs`). Presets provide toolchains, not every project's dependencies: test containers have no network, so projects that need packages need a prepared image.

## Practice tests

Practice tests simulate a complete online assessment, so a real one feels familiar.

1. **Landing page:** the test duration, the number of questions, the instructions and a table of question indexes and types, with **Continue** and **Try Sample Test**.
2. **Onboarding:** the honor code and the AI notice, a Docker check for coding questions and, for proctored tests, **Allow Webcam Access** and **Check for Multiple Monitors**. **Start Test** starts a countdown that never pauses.
3. **The test:** **Test home** lists every question with its status and **Solve** / **Modify**; a collapsible side list shows question names. Coding questions use the coding workspace with **Run Code**, **Run Tests** and **Save & Proceed**. Multiple-choice questions show single or multiple correct answers with **Clear Selection**; written answers have a small formatting toolbar. Everything autosaves.
4. **Time:** a nudge appears with less than 5 minutes left. When the countdown reaches zero the test ends by itself.
5. **Submit Test:** an incomplete-submission check lists questions that won't be evaluated, then a final confirmation.
6. **The report:** total and per-question scores, which code was evaluated and why, a multiple-choice review with explanations, rubric feedback and a model answer for written answers, an integrity log, and the number of messages to the AI assistant.

Scoring follows the usual assessment rules:
- **Coding:** the share of weighted test cases passed. Code counts from your last **Save & Proceed**, failing that your last **Run Tests**, failing that your last **Run Code**. Code you typed but never ran or saved is not evaluated.
- **Multiple choice:** single-answer questions are all or nothing. Multiple-answer questions give partial credit for each correct option, but choosing more options than there are correct answers scores zero.
- **Written answers:** graded by a local model against a 3–6 point rubric; without a model they are left ungraded with the model answer shown.

| Setting | Options |
| --- | --- |
| Integrity | **Standard:** tab switches (with time away) and pastes from outside the test are recorded. **Secure mode:** full screen is enforced with a prompt to return, switching tabs shows a warning, and pasting from outside the test into the code editor is blocked. **Proctored:** Secure mode plus a webcam preview (nothing is recorded or sent) and a single-monitor check. |
| AI assistant | **None**; **Guarded** (the default where AI is allowed: Ask mode, hints and explanations, no full solutions); **Unguarded** (full help plus inline suggestions). The conversation is part of the report. |

Ready-made tests: a sample test, a coding screen, a full software-engineer assessment, an AI-assisted coding assessment, a back-end assessment, a proctored coding assessment and a fundamentals quiz. The custom builder lets you choose the number of Easy, Medium and Hard coding questions, multiple-choice questions and topics, written answers, the duration, the AI level and the integrity level.

### The question bank

80 multiple-choice questions across 16 topics (data structures, algorithms, complexity, databases, operating systems, networking, concurrency, security, object-oriented design, system design, testing, Git, web, Python, JavaScript and Java), a quarter of them with several correct answers, and 12 written-answer questions. Every "what does this print?" answer was checked by running the code. They live in `mcq/`; see [mcq/AUTHORING.md](mcq/AUTHORING.md), and check them with `node scripts/validate-mcq.mjs`.

## Mock interviews

**Coding interview** (30, 45 or 60 minutes; 60 by default). Choose a language, a difficulty or a specific question. The interviewer introduces the problem, answers clarifying questions, asks for your approach and its complexity, then lets you code. It follows the stage of the interview (introduction, approach, coding, testing and follow-ups, wrap-up), sees your current code, runs and submissions, gives hints when you ask, checks in after a long silence, and asks follow-ups after you submit. The reference solution is in its instructions for judging hints and is never meant to be shown to you.

**Technical screen, system design, behavioural and AI fluency** (20–60 minutes). Conversation interviews by text or voice. The technical screen and behavioural interview take a role (software, front-end, back-end, full-stack, mobile, data, ML or DevOps engineer) and a level. System design picks a problem, such as a URL shortener or a ride-hailing dispatch service, and adds a notes pane the interviewer reads. It moves through requirements, high-level design, deep dives and wrap-up. AI fluency covers how language models and AI tools work, how you prompt them and verify their output, and their limits and risks.

**AI-assisted repo interview.** A guided repo opens in the workspace with an Interviewer panel. It asks how you plan to use the AI, why you prompted it the way you did, and how you checked its work. Phase changes are reported to it.

**Feedback.** Ending the interview (or running out of time) runs your final code against every test case, then the reviewer model scores each area from 1 to 5 within bounds set by the recorded evidence:

| Interview | Areas | Evidence used for the bounds |
| --- | --- | --- |
| Coding | Problem-solving skills, code quality, technical communication, language proficiency | Final tests passed, runs and submissions, hints, compile and runtime errors, words written to the interviewer, clarifying questions, whether you discussed complexity |
| Technical screen | Technical knowledge, depth, problem-solving approach, technical communication | Number and length of answers |
| System design | Requirements and scoping, high-level design, deep dives and trade-offs, communication | Number and length of answers, words of design notes |
| Behavioural | Ownership and impact, collaboration, learning and self-awareness, structured communication | Number and length of answers, concrete examples |
| AI fluency | AI concepts, applying AI to engineering work, judgement and verification, communication | Number and length of answers, concrete examples |
| AI-assisted repo | Framing, judging, steering | Prompts and how specific they were, Plan mode use, pasted task text, AI changes verified by a test run, declined AI actions, restored checkpoints, phases passed |

The average maps to an overall recommendation: **Strong Hire** (4.5 and above), **Hire** (3.75), **Lean Hire** (3), **Lean No Hire** (2.25) or **No Hire**. Without a reviewer model the bounds alone produce the scores. For 15 minutes after the report you can ask the interviewer about it.

**Voice.** Interviewer replies can be read aloud with the browser's speech synthesis, which runs locally. Voice input uses the browser's SpeechRecognition where available; in Chrome and Edge the audio is transcribed by the browser vendor's online service, so it is **not** local. You review the recognized text before sending. Browsers without recognition use text.

## Execution and storage

- Loopback-only HTTP server with Host and Origin checks, designed for one local user. The page's Content-Security-Policy allows only same-origin scripts; Monaco needs inline styles, `blob:` workers and a `data:` font.
- **Coding questions** compile once and run every test case in one disposable container per run: no network, a read-only root filesystem, read-only code and test mounts, dropped capabilities, 768 MB memory, one CPU, 128 processes, a 20 MB output cap per test and a per-test time limit. Output goes to tmpfs during the timed run. Go keeps a build cache in the `dg-judge-gocache` volume.
- **Repo commands and tests** run in Docker with networking disabled, dropped capabilities, no-new-privileges and CPU, memory, process and time limits. The repository is mounted read-only and copied into the container, so commands can't change your files; only file edits (yours or the agent's, after approval) do.
- **JavaScript** for guided repos and take-homes runs in a Web Worker whose script is served with `default-src 'none'`, which blocks network requests. **Python** guided repos run in `python:3.12-slim` with structured per-test results (`harness/pyrunner.py`).
- Data lives under `.sessions/`: guided and repo sessions (with their agent conversations in `assistant/`), `coding/` for question drafts, submissions and assistant chats, `mock/` for interviews, and `tests/` for practice tests (with any AI conversations from those tests). The task catalog is cached in `.task-cache/`. Nothing is deleted automatically; sessions, Docker images and model weights can use a lot of disk over time.
- The file tree indexes up to 20,000 files, 24 directory levels and 150 KB per text file. Dotfiles, symlinks, dependency folders and binary files are excluded. The agent edits files up to 400 KB.
- Docker isolation is suitable for personal practice. It is not a production multi-tenant security boundary.

## Verification

```sh
# Automated checks; no model or running app needed
npm test
npm run validate                       # guided problems and take-home tasks, both languages
node scripts/validate-questions.mjs    # every coding question in all five languages (Docker)
node scripts/validate-mcq.mjs          # the multiple-choice and written-answer bank

# Live checks against a running app (npm start in another terminal)
node scripts/smoke.mjs                 # repo API, path checks, Docker test runs, terminal
node scripts/smoke.mjs --tasks         # also imports a historical task
node scripts/python-smoke.mjs          # Python incident fails, then passes after a fix
node scripts/practice-smoke.mjs python # a full guided session through the API
node scripts/practice-smoke.mjs javascript
node scripts/assisted-smoke.mjs        # coding question run, agent with approvals and restore, mock interview report
```

`npm test` runs 35 checks, covering the in-browser runner, problems and questions, session lifecycles, evidence and review bounds, interview scoring bounds and stages, context-window trimming, agent auto-continuation, diffs, workspace change tracking, checkpoint restore, path restrictions, multiple-choice scoring and the question bank, building every ready-made practice test, and the end-of-test evaluation rule. Live scripts create sessions under `.sessions/`, may download Docker images and use installed models. They don't test the microphone or the browser layout.

## Architecture and source map

```text
Browser (dist/) ──HTTP + NDJSON streams──> Node.js server (server.mjs)
                                             ├── Ollama on localhost:11434 (chat, tools, fill-in-the-middle)
                                             ├── Docker CLI → judge, sandbox and test containers
                                             └── Git, the GitHub API and the Hugging Face dataset API
```

| File or directory | Responsibility |
| --- | --- |
| `server.mjs` | HTTP server, static files and CSP, jobs, repo sessions and test runs, route wiring |
| `coding.mjs`, `judge.mjs` | Coding questions: loading, drafts and submissions; the multi-language judge |
| `assistant.mjs` | Ask, Plan and Agent modes, tools and approvals, checkpoints, saved sessions, context fitting, inline completions |
| `workspace-api.mjs` | One interface over guided and repo workspaces: files, changes, diffs, terminal and tests |
| `mock.mjs` | Mock interviews: interviewer prompts and streaming, runs and submissions, evidence bounds and reports |
| `tests-engine.mjs`, `mcq.mjs` | Practice tests: templates, attempts, answers, integrity events, end-of-test evaluation and the report; the multiple-choice and written-answer bank and its scoring |
| `dist/tests.js` | Practice tests lobby and custom builder, landing page and onboarding, the test room, and the report |
| `problems.mjs`, `practice.mjs`, `practice-routes.mjs`, `practice-review.mjs` | Guided problems: content, session state, routes and the evidence-bounded review |
| `open-ended.mjs` | Take-home tasks |
| `sandbox.mjs`, `harness/pyrunner.py` | Python sandbox for guided repos |
| `task-source.mjs`, `runtimes.mjs`, `challenges.mjs` | SWE-bench task catalog, runtime presets, built-in incidents |
| `locks.mjs` | Serialized updates to session files |
| `questions/`, `problems/`, `open-tasks/` | Content, each with an authoring guide |
| `dist/app.js` | Shell, routing, home, activity, guide and local setup |
| `dist/coding.js` | Question library and the coding workspace |
| `dist/repos.js` | Code repos lobby, guided start dialog, answer key and guided feedback |
| `dist/ade.js` | The code-repo workspace |
| `dist/assistant-ui.js`, `dist/diff.js` | The assistant chat (modes, approvals, @ and / menus, checkpoints); line diffs |
| `dist/mock.js` | Mock interview lobby, room, interviewer panel and report |
| `dist/monaco.js`, `dist/vendor/monaco/` | Monaco loader, themes, settings and inline suggestions; the vendored editor (MIT) |
| `dist/style.css`, `dist/app.css`, `dist/figma.css` | Base styles; layouts for the new screens; the design layer loaded last (Inter, neutral greys with a blue accent, compact controls, floating panels, dark menus), in the spirit of design-tool editors such as Figma |
| `dist/vendor/inter/` | The Inter variable font (SIL Open Font License 1.1), served locally |
| `dist/vendor/monaco-vim/`, `dist/vendor/monaco-emacs/` | Vim and Emacs key bindings for the editor (both MIT), loaded on first use |
| `questions/`, `mcq/` | Coding questions; multiple-choice and written-answer questions |
| `dist/open-ended.js`, `dist/report.js`, `dist/markdown.js`, `dist/ui.js` | Take-home pages, report parts, safe markdown, DOM helpers |
| `dist/runner-core.js`, `dist/runner-worker.js` | In-browser JavaScript test runner |
| `tests/`, `scripts/` | Automated checks, validators and live smoke scripts |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| The app won't start | Node version, and whether port 3210 is in use |
| "Docker is not running" | Start Docker Desktop with Linux containers (WSL 2 on Windows) |
| The assistant or interviewer is unavailable | Start Ollama and pull a chat model, such as `qwen3:8b` |
| The agent describes changes but doesn't make them | Use a model with tool support (the picker marks models without it), or a larger model |
| No inline suggestions | Pull a fill-in-the-middle model (`qwen2.5-coder:3b`) and check the editor settings |
| The first run is slow | A Docker image or model is downloading; real-world task images can be several GB |
| Missing dependencies in a repo | Test containers have no network; set a prepared image in the Tests tab |
| GitHub search fails | The public API is rate limited; paste a repository URL instead |
| No microphone button | The browser doesn't support SpeechRecognition, or permission was denied; type instead |

## Current scope and limitations

A local, single-user practice tool. Feedback comes from local models and recorded evidence: it is practice guidance, not a hiring assessment. An 8B local agent makes mistakes that a frontier model wouldn't; reviewing and correcting it is part of the practice. The terminal runs one command at a time in a disposable copy, not an interactive shell. Guided-problem time limits were calibrated on a Ryzen 5 7500X3D. Imported GitHub repositories don't come with a chosen issue. There is no account system, cloud sync, automatic session cleanup or production authentication.

## Licensing and attribution

The Monaco editor in `dist/vendor/monaco` is MIT-licensed (see its `LICENSE` and `ThirdPartyNotices.txt`). The Inter typeface in `dist/vendor/inter` is licensed under the SIL Open Font License 1.1 (see its `LICENSE`). The Vim and Emacs key bindings in `dist/vendor/monaco-vim` and `dist/vendor/monaco-emacs` are MIT-licensed (see their `LICENSE` files). SWE-bench Verified and SWE-bench Multilingual are provided under their upstream dataset licenses, and cloned repositories keep their own licenses. Model weights and container images keep their upstream terms.

This project doesn't yet include its own `LICENSE` file. Choose one before presenting the code as reusable under a specific license.
