# Foundry: CI job orchestrator

Foundry runs our CI pipelines. A pipeline file lists the tasks of a build
(install, compile, run the tests, package, deploy), how long each one takes and
which tasks must finish before it can start. Foundry parses the file, validates
the dependency graph and plans which runner executes which task, and when.

```
                  0         10        20
install     r0   |==                        | 0-2
seed-db     r0   |  ===                     | 2-5  [postgres]
compile     r0   |     ====                 | 5-9
lint        r0   |         =                | 9-10
...
```

## Pipeline files

```yaml
# comments run to the end of the line
compile:
  duration: 4            # whole minutes on one runner (required, >= 1)
  resource: linux        # optional runner label

package:
  duration: 2
  after: compile, lint   # inline list; [compile, lint] also works

deploy:
  duration: 3
  after:                 # block list, one dependency per line
    - package
    - smoke-tests
```

- A task is a top-level key ending in `:`. Its settings are indented below it.
- `after` names the tasks that must **finish** before this one may start.
  Tasks can appear in any order; a dependency may be defined later in the file.
- `resource` is shown in reports. The scheduler treats all runners as identical
  for now.

## Parallel runners (in progress)

Today every pipeline runs on a single runner (`serialSchedule`). We are adding
`schedule(graph, workers)`, which plans a pipeline on several identical runners
with deterministic list scheduling:

- **Priority.** A task's *remaining path* is its duration plus the largest
  remaining path among the tasks that depend on it (just its duration if none
  do). Higher priority runs first; ties go to the alphabetically smaller name.
- Time starts at minute 0. Whenever runners are idle and tasks are ready (all
  dependencies finished), the highest-priority ready task starts on the
  lowest-numbered idle runner. Repeat until no runner is idle or no task is
  ready, then jump to the next minute at which a running task finishes.
- All tasks finishing at the same minute free their runners and unblock their
  dependents before anything new starts at that minute.

## Layout

| Module | Responsibility |
| --- | --- |
| `src/foundry/Task.java`, `src/foundry/PipelineError.java` | `Task` model and `PipelineError` (`PipelineSyntaxError` and `CycleError` extend it) |
| `src/foundry/Parser.java` | `Parser.parsePipeline`: pipeline file text to a list of tasks |
| `src/foundry/DependencyGraph.java` | `DependencyGraph`: validation, cycle detection, topological order, critical path; `DependencyGraph.load` |
| `src/foundry/Slot.java`, `src/foundry/Schedule.java` and `src/foundry/Gantt.java` | `Slot` and `Schedule` models, `Gantt.render` text chart |
| `src/foundry/Scheduler.java` | `Scheduler.serialSchedule` (today) and `Scheduler.schedule` (parallel runners) |
| `src/foundry/Samples.java` | Pipelines from the web and mobile teams |
| `src/Main.java` | Prints the critical path and runner plans for the samples |

A `Slot` is a record `Slot(task, worker, start, end)`; `schedule.slotFor(name)`
looks one up by task name (`null` if the task is not in the schedule).

## Running

Java 21, with the JUnit 5 console launcher (`junit.jar`) for the tests:

```
javac -d out $(find src -name '*.java') && java -cp out Main
javac -d out -cp junit.jar $(find src tests -name '*.java') && java -jar junit.jar execute --class-path out --scan-class-path
```
