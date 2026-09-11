# Debug Gym

A local AI-assisted debugging interview practice workspace. No npm dependencies. Requires Node.js 22+, Git, Docker Desktop with Linux containers, and Ollama.

```powershell
npm start
```

Open http://127.0.0.1:3210. Start Ollama and Docker Desktop first. Download the assistant once with `ollama pull qwen2.5-coder:0.5b`. The app downloads Docker images on demand.

## Practice modes

- Two small built-in JavaScript incidents and a Python pricing incident with intentionally failing tests.
- Random real-world tasks from [SWE-bench Multilingual](https://www.swebench.com/multilingual.html), fetched through the public Hugging Face dataset API. Filters support language and pre-2021 tasks. Selections are remembered across restarts and cycle after exhaustion. This is a finite catalog, not an infinite generator. The catalog refreshes after seven days.
- Public GitHub repository search and import, including large/archived repositories. These imports require you to select an issue and provide a suitable test command and dependencies.

Random tasks check out their exact `base_commit` before the original fix. Reference solution patches and hints are discarded; the candidate receives the issue description and source. The task's prepared SWE-bench image and evaluation script supply the regression environment. Tasks include both bugs and feature requests. Upstream images may be large, unavailable, or require more resources than the default 4 GB/15-minute limit. The output is not an official SWE-bench score: inspect the individual test results. Some upstream evaluation scripts exit successfully even when tests fail.

## Languages

16 presets: JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, R, Elixir, Perl, and Bash. Presets provide toolchains, not every project's dependencies. TypeScript uses Node 24's native type stripping; projects requiring full TypeScript compilation need a prepared image. Generic commands are editable and a custom prebuilt image can be supplied. Random benchmark tasks cover the nine languages in that dataset and use its own historical environment.

## 45-minute interview mode

Download the separate interviewer with `ollama pull qwen2.5-coder:3b`. Use **Set up an interview** to choose a language/codebase, or start an interview from any existing workspace. The environment is prepared before the clock starts. The interviewer uses a stronger 3B model; the original copilot remains 0.5B. These are local language models, not human-equivalent interview assessors.

The server persists a 45-minute deadline, transcript, hint count, edited filenames, copilot usage, and recent test output. Reloading does not reset the timer. Stages cover understanding (0–5 minutes), debugging (5–22), a model-proposed feature (22–35), LLD (35–42), and reflection (42–45). The candidate can request progressive hints or move to feature work early. Feature criteria remain visible in the interviewer window. The LLD discussion covers interfaces, responsibilities, cohesion/coupling, dependency injection, testability, and tradeoffs.

At the deadline, the active page requests feedback automatically. If the page is closed, the server still refuses further interview work after the deadline and feedback is requested when the session is reopened. Finish or Give up ends early. Feedback covers debugging, implementation, testing, LLD, and communication, grounded in the transcript, saved selected file, and observed actions. Unobserved areas should not be rated. If the model is unavailable, the app returns an explicitly unscored observations report. Reports and transcripts can be downloaded as JSON; previous interview records are retained in the session directory when a new interview starts.

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

SWE-bench Multilingual is provided under its upstream dataset license; cloned repositories retain their own licenses. See [the dataset card](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual).
