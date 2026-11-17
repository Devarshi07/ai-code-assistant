package tests

import (
	"reflect"
	"sort"
	"testing"

	"debuggym/task-scheduler/foundry"
)

// These tests also use load (phase1_test.go).

// Duration-first would start lint and docs; the setup -> build -> bundle chain
// is longer, so it must start first.
const chainFirst = `
setup:
  duration: 1
build:
  duration: 2
  after: setup
bundle:
  duration: 6
  after: build
lint:
  duration: 5
docs:
  duration: 4
`

// alpha, bravo and charlie all have a remaining path of 4 minutes.
const ties = `
charlie:
  duration: 4
bravo:
  duration: 4
zulu:
  duration: 2
  after: alpha
alpha:
  duration: 2
`

// api and web finish at the same minute.
const simultaneous = `
notify:
  duration: 1
web:
  duration: 2
api:
  duration: 2
integration:
  duration: 5
  after: api, web
`

// Runners free up in different orders; the lowest-numbered idle one is used.
const runnerChoice = `
build:
  duration: 3
test:
  duration: 7
  after: build
ship:
  duration: 2
  after: test
lint:
  duration: 1
docs:
  duration: 9
report:
  duration: 12
  after: docs, lint
`

// where is a task's expected placement: runner, start minute, end minute.
type where [3]int

// table reduces a plan to task -> [runner, start, end].
func table(plan *foundry.Plan) map[string]where {
	out := map[string]where{}
	for _, s := range plan.Slots {
		out[s.Task] = where{s.Worker, s.Start, s.End}
	}
	return out
}

// schedule plans the graph and stops the test if the scheduler fails.
func schedule(t *testing.T, graph *foundry.DependencyGraph, workers int) *foundry.Plan {
	t.Helper()
	plan, err := foundry.Schedule(graph, workers)
	if err != nil {
		t.Fatalf("Schedule(%d runners): %v", workers, err)
	}
	if plan == nil {
		t.Fatalf("Schedule(%d runners) returned a nil plan", workers)
	}
	return plan
}

// assertValidSchedule checks one slot per task, right lengths, dependencies
// first and no runner double-booked.
func assertValidSchedule(t *testing.T, graph *foundry.DependencyGraph, plan *foundry.Plan, workers int) {
	t.Helper()
	if plan.Workers != workers {
		t.Fatalf("plan has %d runners, want %d", plan.Workers, workers)
	}
	var planned []string
	for _, s := range plan.Slots {
		planned = append(planned, s.Task)
	}
	names := graph.Names()
	sort.Strings(planned)
	sort.Strings(names)
	if !reflect.DeepEqual(planned, names) {
		t.Fatalf("every task must be scheduled exactly once: planned %d slots for %d tasks", len(planned), len(names))
	}
	byWorker := map[int][]foundry.Slot{}
	for _, s := range plan.Slots {
		task := graph.Get(s.Task)
		if s.Worker < 0 || s.Worker >= workers {
			t.Fatalf("%s is on runner %d", s.Task, s.Worker)
		}
		if s.Start < 0 {
			t.Fatalf("%s starts before minute 0", s.Task)
		}
		if s.End-s.Start != task.Duration {
			t.Fatalf("%s has the wrong length", s.Task)
		}
		for _, dep := range task.Deps {
			if s.Start < plan.SlotFor(dep).End {
				t.Fatalf("%s started before %s finished", s.Task, dep)
			}
		}
		byWorker[s.Worker] = append(byWorker[s.Worker], s)
	}
	for worker, slots := range byWorker {
		sort.Slice(slots, func(i, j int) bool { return slots[i].Start < slots[j].Start })
		for i := 1; i < len(slots); i++ {
			if slots[i-1].End > slots[i].Start {
				t.Fatalf("runner %d runs %s and %s at once", worker, slots[i-1].Task, slots[i].Task)
			}
		}
	}
	latest := 0
	for _, s := range plan.Slots {
		latest = max(latest, s.End)
	}
	if plan.Makespan() != latest {
		t.Fatalf("makespan = %d, want %d", plan.Makespan(), latest)
	}
}

// check plans the pipeline, validates the plan and compares every slot.
func check(t *testing.T, text string, workers int, expected map[string]where) *foundry.Plan {
	t.Helper()
	graph := load(t, text)
	plan := schedule(t, graph, workers)
	assertValidSchedule(t, graph, plan, workers)
	if got := table(plan); !reflect.DeepEqual(got, expected) {
		t.Fatalf("got %v, want %v", got, expected)
	}
	return plan
}

func TestPhase2SingleRunnerFollowsPriority(t *testing.T) {
	plan := check(t, foundry.WebApp, 1, map[string]where{
		"install": {0, 0, 2}, "compile": {0, 2, 6}, "seed-db": {0, 6, 9}, "unit-tests": {0, 9, 14},
		"e2e-tests": {0, 14, 20}, "lint": {0, 20, 21}, "package": {0, 21, 23}, "deploy": {0, 23, 26},
	})
	if plan.Makespan() != 26 {
		t.Fatalf("makespan = %d, want 26", plan.Makespan())
	}
}

func TestPhase2LongChainsStartFirst(t *testing.T) {
	plan := check(t, chainFirst, 2, map[string]where{
		"setup": {0, 0, 1}, "lint": {1, 0, 5}, "build": {0, 1, 3}, "bundle": {0, 3, 9}, "docs": {1, 5, 9},
	})
	if plan.Makespan() != 9 {
		t.Fatalf("makespan = %d, want 9", plan.Makespan())
	}
}

func TestPhase2TiesGoToTheAlphabeticallyFirstName(t *testing.T) {
	check(t, ties, 2, map[string]where{
		"alpha": {0, 0, 2}, "bravo": {1, 0, 4}, "charlie": {0, 2, 6}, "zulu": {1, 4, 6},
	})
}

func TestPhase2EverythingFinishingTogetherIsReleasedFirst(t *testing.T) {
	check(t, simultaneous, 2, map[string]where{
		"api": {0, 0, 2}, "web": {1, 0, 2}, "integration": {0, 2, 7}, "notify": {1, 2, 3},
	})
}

func TestPhase2LowestNumberedIdleRunnerIsUsed(t *testing.T) {
	check(t, runnerChoice, 3, map[string]where{
		"docs": {0, 0, 9}, "lint": {1, 0, 1}, "build": {2, 0, 3}, "test": {1, 3, 10}, "report": {0, 9, 21}, "ship": {1, 10, 12},
	})
}

func TestPhase2WebAppOnThreeRunners(t *testing.T) {
	plan := check(t, foundry.WebApp, 3, map[string]where{
		"install": {0, 0, 2}, "seed-db": {1, 0, 3}, "compile": {0, 2, 6}, "lint": {2, 2, 3},
		"unit-tests": {0, 6, 11}, "e2e-tests": {1, 6, 12}, "package": {0, 11, 13}, "deploy": {0, 13, 16},
	})
	if plan.Makespan() != 16 {
		t.Fatalf("makespan = %d, want 16", plan.Makespan())
	}
}

func TestPhase2MobileReleaseOnTwoRunners(t *testing.T) {
	plan := check(t, foundry.MobileRelease, 2, map[string]where{
		"fetch-deps": {0, 0, 2}, "build-ios": {0, 2, 10}, "build-android": {1, 2, 8}, "unit-tests": {1, 8, 12},
		"ui-tests": {0, 10, 19}, "sign-ipa": {1, 12, 14}, "sign-apk": {1, 14, 15}, "publish": {0, 19, 21},
	})
	if plan.Makespan() != 21 {
		t.Fatalf("makespan = %d, want 21", plan.Makespan())
	}
}

func TestPhase2PlentyOfRunnersReachesTheCriticalPath(t *testing.T) {
	for _, text := range []string{foundry.WebApp, foundry.MobileRelease} {
		graph := load(t, text)
		plan := schedule(t, graph, 20)
		assertValidSchedule(t, graph, plan, 20)
		if want := graph.CriticalPath().Minutes; plan.Makespan() != want {
			t.Errorf("makespan = %d, want the critical path of %d", plan.Makespan(), want)
		}
	}
}

func TestPhase2EmptyPipeline(t *testing.T) {
	plan := schedule(t, load(t, "# nothing here yet\n"), 4)
	if len(plan.Slots) != 0 || plan.Makespan() != 0 {
		t.Fatalf("got %d slots and makespan %d, want an empty plan", len(plan.Slots), plan.Makespan())
	}
}

func TestPhase2NeedsAtLeastOneRunner(t *testing.T) {
	if _, err := foundry.Schedule(load(t, foundry.WebApp), 0); err == nil {
		t.Fatal("got no error, want an error for 0 runners")
	}
}
