# Debug Gym — conversation and project summary

This document summarizes the product requests, implementation, local setup, validation, and repository handoff from the development conversation. It is a project handoff, not a verbatim chat export. Authentication codes, credentials, and unrelated machine details are intentionally omitted.

## 1. Original idea

The initial request was for a fast-to-build, lightweight tool for AI-assisted coding interview practice. A candidate should receive a repository to debug, use an intentionally limited local LLM around one billion parameters or smaller, edit code, and run checks. The exercise should test the candidate's reasoning and ability to verify AI advice.

The resulting product is **Debug Gym**, a local browser-based workspace served by Node.js. It uses no npm dependencies. The initial implementation included two intentionally broken JavaScript exercises, GitHub search/import, a file editor, test output, and a local coding copilot.

## 2. Local execution and the small helper

The coding helper uses **Qwen2.5 Coder 0.5B** through Ollama, with a 4K context budget. It receives the saved selected file, task context, recent test output, and a bounded conversation history. It cannot directly edit files or execute commands.

Candidate code runs through Docker rather than on the host. Containers have network access disabled, CPU/memory/process/time limits, dropped capabilities, and read-only mounts of the host repository. Generic tests run in a disposable writable copy; historical benchmark tests use disposable prepared environments.

The user later asked for Ollama and Docker to be installed so the app could actually work. Docker Desktop was already present, but WSL was missing and Docker startup was broken. We installed WSL and Ollama, downloaded the model, diagnosed stale Docker runtime sockets, backed up the affected temporary runtime directories, and got Docker responding. No automatic Windows restart was performed.

After the interviewer feature was requested, a separate **Qwen2.5 Coder 3B** model was also downloaded. Both models responded through the app during live checks.

## 3. More languages and recurring real-world tasks

The next request expanded the tool beyond two languages and asked for repeated access to famous, large, or legacy repositories with debugging problems.

The implementation added **16 runtime presets**:

JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, R, Elixir, Perl, and Bash.

These presets supply language toolchains, not every repository's dependencies. The user can edit generic test commands and select a custom prepared image. Only selected images download on demand.

For concrete real-world tasks, the app integrates **SWE-bench Multilingual** through the public Hugging Face dataset API. The catalog fetched during development contained 300 tasks across nine languages and 41 distinct repository names. The upstream overview describes 42 repositories; the observed fetched-data count is documented separately.

The random-task flow:

1. Filter by language and optionally by a legacy task date of 2020 or earlier.
2. Select a task not already seen in the matching rotation.
3. Show the real issue description and repository information.
4. Fetch and check out the exact historical base commit before the original fix.
5. Make the source available in the editor.
6. Use the task's upstream prepared image and regression script when running benchmark tests.

Reference solution patches and hints are discarded from the local task cache. The candidate receives the issue and source, not the reference fix. Task selections persist across restarts; the matching pool cycles after exhaustion. The catalog refreshes after seven days, so this is a finite task library rather than an infinite codebase generator.

Manual GitHub search/import remains available, including larger and archived projects. The initial small-repository search restriction was removed. Manual imports still require the candidate to select an issue and configure a usable test environment.

## 4. The coding workspace

The workspace provides:

- An incident brief and source metadata.
- A file explorer with path filtering for larger repositories.
- A plain text code editor with Tab indentation and Ctrl/Cmd+S.
- Saving before file switches, test runs, and copilot questions.
- Creation of new files and nested source directories for modules and tests.
- Runtime selection, configurable generic test commands, and image selection.
- Job progress and test output.
- A separate small-model copilot conversation.

The explorer indexes up to 20,000 files and 24 directory levels, with a 150 KB limit per editable file. It hides dotfiles and common dependency directories, rejects symlinks, and rejects binary content when opened. File access checks block traversal and Windows alternate-data-stream paths. Git long-path support was enabled after a Babel checkout exposed Windows path-length failures.

The short exercise collection now contains JavaScript checkout and cache incidents plus a Python pricing incident. The exercises intentionally fail until repaired.

## 5. The 45-minute interview request

The user then asked for a small interviewer window that could conduct a realistic conversation: present a codebase, ask the candidate to talk through debugging, request a small feature, probe low-level design, give hints when the candidate is stuck, and provide feedback after 45 minutes or an early exit.

We added a floating, minimizable interviewer window backed by the separate local 3B model. Candidates can use typed answers or voice dictation, request hints, move to a feature extension early, and finish or give up for a review.

The interview phases are:

| Minutes | Focus |
| --- | --- |
| 0–5 | Understand the issue and expected behavior |
| 5–22 | Reproduce, debug, repair, and verify |
| 22–35 | Implement a small feature extension |
| 35–42 | Explain low-level design decisions |
| 42–45 | Reflect and summarize |

The server persists the deadline; refreshing does not grant a new 45 minutes. Environment preparation happens before starting the timer. The active page requests feedback at timeout. If the page was closed, the deadline still applies and the review is requested when the session is reopened. The app refuses new interview work after the deadline or after the interview ends, until the candidate returns to free practice.

The LLD discussion includes interfaces, responsibility boundaries, dependency injection, cohesion and coupling, error contracts, extensibility, testability, and tradeoffs. It is a prompted discussion, not a complete static analysis of the repository.

## 6. Feature assignments and hints

The small model initially proposed a cache extension that duplicated behavior already present in `set`. To make the short exercises more useful, explicit feature assignments were added:

- **JavaScript/Python pricing:** add a maximum monetary discount cap, preserve existing callers, reject negative caps, test edge cases, and separate discount policy from summing items.
- **Cache:** add `size()` to count live entries and remove expired entries, retain falsy values, preserve the API, and share the expiration rule with `get`.

Other repositories still use model-proposed extensions, which can need candidate review for feasibility and existing functionality. Hints are progressively requested through the interviewer; the app records explicit hint requests.

## 7. Voice behavior

Voice uses browser **SpeechRecognition** for dictation and **SpeechSynthesis** for spoken replies. The candidate can review the transcript before sending it. The interviewer model receives text, not raw microphone audio.

This is not a fully local audio-model pipeline. Browser speech recognition may use an online provider, depends on browser support and microphone permission, and was not exercised in the backend smoke tests. Text answers remain available when recognition is unsupported or denied.

## 8. Feedback design and the important correction

Live testing exposed unreliable feedback from the small interviewer model: it sometimes credited its own suggestions to the candidate or made criticisms unsupported by the candidate's answer.

The final implementation therefore separates recorded evidence from AI recommendations:

- Only submitted candidate answers count as candidate statements.
- Interviewer questions, hints, and generated feature requests are not credited as candidate work.
- Discussion evidence quotes the candidate's actual words.
- Saved filenames, test runs, hints, and copilot requests are recorded.
- Areas without implementation or test evidence are marked **Not observed**.
- Recorded edits and command completion are not treated as proof of correctness.
- The model supplies three future practice exercises instead of an authoritative hiring judgment.
- No overall skill score is assigned.

The review covers debugging, implementation, testing, LLD, and communication. Discussion categorization uses simple text matching and remains limited. Feature completion is not independently graded. If model generation fails, the app returns an explicitly unscored observations report with generic practice suggestions.

Reports and transcripts can be downloaded as JSON. A candidate can return to free practice afterward, and earlier interview records are retained when a new interview is started in that session.

## 9. Architecture

The app uses a Node.js standard-library HTTP server and vanilla HTML/CSS/JavaScript. It stores local files rather than using a database.

Main modules:

- `server.mjs`: routes, session files, Git operations, Docker jobs, Ollama requests, and path checks.
- `interview.mjs`: interview state, deadline, conversation, evidence, and feedback.
- `task-source.mjs`: catalog retrieval, sanitization, filtering, and random selection.
- `runtimes.mjs`: language images, default commands, and runtime inference.
- `challenges.mjs`: built-in exercises and feature criteria.
- `dist/`: authored UI, including the interviewer window.
- `tests/`: automated boundary and correctness checks.
- `scripts/`: live integration smoke checks.

Sessions and interview records live in `.sessions/`. The sanitized catalog and seen-task history live in `.task-cache/`. Both directories are excluded from Git. Model weights and Docker images are stored by their respective applications. No automatic cleanup of these resources was added.

## 10. Verified results

At completion of the implementation:

- All **14 automated tests** passed.
- JavaScript tests ran in Docker, failed on the original exercise, and passed all four tests after a repair.
- Python tests ran in Docker, failed on the original exercise, and passed all three tests after a repair.
- The public task catalog loaded all 300 rows.
- A historical Preact task imported at its recorded base commit, with 312 indexed files in that checked example.
- Both Ollama models returned responses through the application.
- Live interview checks covered conversation, hints, explicit feature assignment, feedback, and return to free practice.
- The new-file endpoint successfully created a nested source module.
- Deadline persistence, timeout refusal, early termination, idempotent finalization, solution exclusion, candidate-only feedback evidence, and file boundaries were covered by automated tests.

These results do not mean that every runtime image or all 300 benchmark suites were tested. Browser visual QA and real microphone capture were not performed. Successful benchmark-script completion is not an official SWE-bench correctness score.

## 11. GitHub handoff

The user asked to publish the project to [Devarshi07/ai-code-assistant](https://github.com/Devarshi07/ai-code-assistant).

The destination initially contained a README commit. We initialized the local project as a Git repository, preserved that existing history, and committed the application source, documentation, and tests. Local generated sessions, task caches, downloaded models, and Docker images were excluded.

The first push waited for authentication. GitHub CLI sign-in was completed by the user, then the app was pushed successfully to `main` and the remote commit was verified against the local commit.

The initial application commit is `69cab8085f76d12b1c2e2df81fbc863365dd623b` (`69cab80`). This summary and the expanded README are a subsequent documentation update.

## 12. Remaining limitations and possible next work

The delivered project is a usable local MVP, not a hosted production platform or a replacement for a human interviewer.

Potential next work, not implemented in this conversation:

1. Fully local speech-to-text and speech playback with tested browser integration.
2. A stronger optional interviewer/reviewer model and a more rigorous feedback evaluation set.
3. Reliable regression scoring across more benchmark environments and languages.
4. Better repository-wide context retrieval for the copilot and interviewer.
5. Automated validation of generated feature criteria and candidate feature tests.
6. A richer editor, terminal experience, and code-diff review.
7. Session browsing, cleanup, retention limits, and disk-usage visibility.
8. Production authentication, tenant isolation, quotas, and job orchestration if the app becomes a hosted service.
9. A deliberate project license choice; no project `LICENSE` file has been added.

Large repositories and historical environments can consume substantial disk, memory, and time. Generic language images do not include every dependency. Small models can give incorrect suggestions. Voice may depend on an online browser service. These constraints are documented so future work starts from the actual implementation rather than assumed capabilities.

## Reference links

- [Repository](https://github.com/Devarshi07/ai-code-assistant)
- [Setup and usage README](README.md)
- [SWE-bench Multilingual overview](https://www.swebench.com/multilingual.html)
- [SWE-bench Multilingual dataset](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual)
- [Ollama download](https://ollama.com/download)
- [Qwen2.5 Coder model library](https://ollama.com/library/qwen2.5-coder)
