package tests

import (
	"testing"
	"time"

	"debuggym/task-scheduler/foundry"
)

// These tests also use load (phase1_test.go), schedule, table, where and
// assertValidSchedule (phase2_test.go), and generatePipeline and fingerprint
// (generator_test.go).

// Test shards fan out from build and fan back in to report.
const shards = `
build:
  duration: 3
docs:
  duration: 5
lint:
  duration: 2
test-api:
  duration: 4
  after: build
test-ui:
  duration: 4
  after: build
test-db:
  duration: 2
  after: build
test-cli:
  duration: 1
  after: build
test-e2e:
  duration: 6
  after: build, lint
report:
  duration: 1
  after: [test-api, test-ui, test-db, test-cli, test-e2e]
publish:
  duration: 2
  after: report, docs
`

// generated builds a graph of generated tasks with the default fan-in.
func generated(t *testing.T, seed uint32, count, window int) ([]*foundry.Task, *foundry.DependencyGraph) {
	t.Helper()
	tasks := generatePipeline(seed, count, window, 3, 20)
	graph, err := foundry.NewDependencyGraph(tasks)
	if err != nil {
		t.Fatalf("generated pipeline is invalid: %v", err)
	}
	return tasks, graph
}

// assertSlot checks one task's runner, start and end.
func assertSlot(t *testing.T, plan *foundry.Plan, task string, want where) {
	t.Helper()
	s := plan.SlotFor(task)
	if s == nil {
		t.Fatalf("%s is missing from the plan", task)
	}
	if got := (where{s.Worker, s.Start, s.End}); got != want {
		t.Fatalf("%s is [runner, start, end] = %v, want %v", task, got, want)
	}
}

func TestPhase3TestShardsFanOutAndBackIn(t *testing.T) {
	graph := load(t, shards)
	plan := schedule(t, graph, 3)
	assertValidSchedule(t, graph, plan, 3)
	want := map[string]where{
		"build": {0, 0, 3}, "lint": {1, 0, 2}, "docs": {2, 0, 5}, "test-e2e": {0, 3, 9}, "test-api": {1, 3, 7},
		"test-ui": {2, 5, 9}, "test-db": {1, 7, 9}, "test-cli": {0, 9, 10}, "report": {0, 10, 11}, "publish": {0, 11, 13},
	}
	got := table(plan)
	for task, w := range want {
		if got[task] != w {
			t.Errorf("%s is [runner, start, end] = %v, want %v", task, got[task], w)
		}
	}
	if len(got) != len(want) {
		t.Errorf("planned %d tasks, want %d", len(got), len(want))
	}
}

func TestPhase3GeneratedPipelineMatchesReference(t *testing.T) {
	tasks, graph := generated(t, 11, 600, 30)
	plan := schedule(t, graph, 5)
	assertValidSchedule(t, graph, plan, 5)
	if plan.Makespan() != 1289 {
		t.Fatalf("makespan = %d, want 1289", plan.Makespan())
	}
	assertSlot(t, plan, "lint-7", where{1, 31, 41})
	if got := fingerprint(tasks, plan); got != 143128735 {
		t.Fatalf("fingerprint = %d, want 143128735: the schedule differs from the reference", got)
	}
}

func TestPhase3WidePipelineMatchesReference(t *testing.T) {
	tasks, graph := generated(t, 23, 2000, 400)
	plan := schedule(t, graph, 12)
	assertValidSchedule(t, graph, plan, 12)
	if plan.Makespan() != 1745 {
		t.Fatalf("makespan = %d, want 1745", plan.Makespan())
	}
	assertSlot(t, plan, "scan-1999", where{4, 1654, 1663})
	if got := fingerprint(tasks, plan); got != 829942898 {
		t.Fatalf("fingerprint = %d, want 829942898: the schedule differs from the reference", got)
	}
}

func TestPhase3MonorepoPipelineIsFast(t *testing.T) {
	tasks, graph := generated(t, 2026, 12000, 48)
	start := time.Now()
	plan := schedule(t, graph, 32)
	elapsed := time.Since(start)
	assertValidSchedule(t, graph, plan, 32)
	if plan.Makespan() != 8249 {
		t.Fatalf("makespan = %d, want 8249", plan.Makespan())
	}
	assertSlot(t, plan, "build-11999", where{3, 8236, 8243})
	if got := fingerprint(tasks, plan); got != 1775225865 {
		t.Fatalf("fingerprint = %d, want 1775225865: the schedule differs from the reference", got)
	}
	if limit := 150 * time.Millisecond; elapsed >= limit {
		t.Fatalf("took %dms; 12,000 tasks on 32 runners must schedule in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
	}
}
