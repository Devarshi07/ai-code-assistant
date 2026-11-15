# Authoring open-ended tasks

Open-ended tasks mirror the "your editor, your AI tools" interview format. The candidate gets a small starter project on their machine and builds a service from a brief in about 60 minutes, with whatever AI tools they use at work. When they submit, the app snapshots their folder and runs three groups of tests: the **provided** tests, **hidden acceptance tests**, and any tests the candidate wrote. The candidate pastes their AI transcript, answers three debrief questions generated from their code, and gets a verdict.

## Layout

```
open-tasks/<id>/task.json
open-tasks/<id>/<lang>/starter/**     what the candidate receives (lang = python | javascript)
open-tasks/<id>/<lang>/hidden/**      hidden acceptance tests, never shown before submission
open-tasks/<id>/<lang>/solution/**    reference implementation, layered over starter (used only for validation)
```

| | Python | JavaScript |
| --- | --- | --- |
| Provided tests (in `starter/`) | `tests/test_public.py` | `tests/public.test.js` |
| Hidden tests (in `hidden/`) | `tests/test_acceptance.py` | `tests/acceptance.test.js` |
| Extra file in `starter/` | none | `package.json` with `{"type": "commonjs"}` and a `"test": "node --test \"tests/*.test.js\""` script |

The starter contains:
- a `README.md` with the full brief (the same text as `task.json` `brief`, plus how to run tests);
- the interface as stubs, meaning the classes and method signatures the hidden tests call, each raising `NotImplementedError` or throwing `Error('Not implemented')`, with docstrings that state the contract;
- 4–8 provided tests covering the basic happy path only.

Hidden acceptance tests (15–40) cover every requirement, edge case and error contract in the brief. They must use **only** the documented interface. Python and JavaScript must be equivalent, though names follow each language's conventions.

## The brief

Write it like a real interview prompt: a short product scenario, then requirements in two or three parts of increasing difficulty ("Part 1 · Core", "Part 2 · …", "Part 3 · Stretch"). Every behaviour the hidden tests check must be stated unambiguously, including error types and messages if tests check them, tie-breaking, ordering and time units. Use an **injected clock** (a `now` argument or a clock object) instead of real time, so tests stay deterministic. Most candidates should finish Part 1 and most of Part 2 in 60 minutes.

Use the standard library only. No network, file system, threads or real sleeping. The JavaScript runs in the in-browser runner (see `problems/AUTHORING.md` for the module list) and under real Node.

## task.json

```json
{
  "id": "slotkeeper",
  "title": "SlotKeeper",
  "tagline": "A Calendly-style booking service",
  "minutes": 60,
  "languages": ["python", "javascript"],
  "brief": {"python": "markdown…", "javascript": "markdown…"},
  "debrief": ["fallback question 1", "fallback question 2", "fallback question 3"]
}
```

`brief` may be one string if no identifiers differ between languages. The debrief questions are a fallback; normally a local model writes questions about the candidate's own code.

## Validation

```
node scripts/validate-open-tasks.mjs [task-id ...]
```

The validator checks the schema and the file names, then confirms that the stubbed starter fails the provided and hidden tests, and that the reference solution passes every provided and hidden test in both languages.
