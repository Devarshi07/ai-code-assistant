package tests

import (
	"errors"
	"reflect"
	"sort"
	"strings"
	"testing"

	"debuggym/task-scheduler/foundry"
)

const release = `
build:
  duration: 4
  resource: linux
test:
  duration: 3
  after: build
release:
  duration: 1
  after: [build, test]
`

const nightly = `
# nightly docs job
lint:              # fast
  duration: 1      # minutes

docs:
  duration: 2
  after:
    - lint
  resource: docs-runner

archive:
  duration: 1
  after: docs
`

const diamond = `
checkout:
  duration: 1
build:
  duration: 3
  after: checkout
docs:
  duration: 2
  after: checkout
bundle:
  duration: 1
  after: build, docs
`

const loop = `
a:
  duration: 1
  after: c
b:
  duration: 1
  after: a
c:
  duration: 1
  after: b
`

// row is a task reduced to what the parser tests compare.
type row struct {
	Name     string
	Duration int
	Deps     []string
	Resource string
}

func summary(tasks []*foundry.Task) []row {
	rows := make([]row, len(tasks))
	for i, task := range tasks {
		deps := task.Deps
		if deps == nil {
			deps = []string{}
		}
		rows[i] = row{task.Name, task.Duration, deps, task.Resource}
	}
	return rows
}

// parse reads pipeline text and stops the test if it is rejected.
func parse(t *testing.T, text string) []*foundry.Task {
	t.Helper()
	tasks, err := foundry.ParsePipeline(text)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	return tasks
}

// load validates pipeline text into a graph and stops the test if it is rejected.
func load(t *testing.T, text string) *foundry.DependencyGraph {
	t.Helper()
	graph, err := foundry.LoadPipeline(text)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	return graph
}

func assertRespectsDependencies(t *testing.T, graph *foundry.DependencyGraph, plan *foundry.Plan) {
	t.Helper()
	for _, task := range graph.Tasks() {
		slot := plan.SlotFor(task.Name)
		if slot == nil {
			t.Fatalf("%s is missing from the plan", task.Name)
		}
		if slot.End-slot.Start != task.Duration {
			t.Errorf("%s has the wrong length", task.Name)
		}
		for _, dep := range task.Deps {
			if slot.Start < plan.SlotFor(dep).End {
				t.Errorf("%s started at %d, before %s finished", task.Name, slot.Start, dep)
			}
		}
	}
}

func TestPhase1SettingsAndInlineLists(t *testing.T) {
	want := []row{
		{"build", 4, []string{}, "linux"},
		{"test", 3, []string{"build"}, ""},
		{"release", 1, []string{"build", "test"}, ""},
	}
	if got := summary(parse(t, release)); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestPhase1CommentsBlankLinesAndBlockLists(t *testing.T) {
	want := []row{
		{"lint", 1, []string{}, ""},
		{"docs", 2, []string{"lint"}, "docs-runner"},
		{"archive", 1, []string{"docs"}, ""},
	}
	if got := summary(parse(t, nightly)); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestPhase1WebAppIsReadAsWritten(t *testing.T) {
	tasks := map[string]*foundry.Task{}
	for _, task := range parse(t, foundry.WebApp) {
		tasks[task.Name] = task
	}
	if len(tasks) != 8 {
		t.Fatalf("got %d tasks, want 8", len(tasks))
	}
	want := []row{{"e2e-tests", 6, []string{"compile", "seed-db"}, "chrome"}}
	if got := summary([]*foundry.Task{tasks["e2e-tests"]}); !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
	if got := tasks["deploy"].Deps; !reflect.DeepEqual(got, []string{"package", "e2e-tests"}) {
		t.Errorf("deploy deps = %v, want [package e2e-tests]", got)
	}
}

func TestPhase1MobileReleaseIsReadAsWritten(t *testing.T) {
	want := []row{
		{"fetch-deps", 2, []string{}, ""},
		{"build-android", 6, []string{"fetch-deps"}, "linux"},
		{"build-ios", 8, []string{"fetch-deps"}, "macos"},
		{"unit-tests", 4, []string{"fetch-deps"}, ""},
		{"ui-tests", 9, []string{"build-android", "build-ios"}, "macos"},
		{"sign-apk", 1, []string{"build-android"}, ""},
		{"sign-ipa", 2, []string{"build-ios"}, "macos"},
		{"publish", 2, []string{"sign-apk", "sign-ipa", "ui-tests", "unit-tests"}, ""},
	}
	if got := summary(parse(t, foundry.MobileRelease)); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestPhase1SyntaxErrorsReportTheLine(t *testing.T) {
	cases := []struct {
		text string
		line int
	}{
		{"build:\n  duraton: 4\n", 2},
		{"  duration: 4\n", 1},
		{"build:\n  duration: 4\n  - lint\n", 3},
		{"lint:\n  duration: 1\nbuild:\n  duration: four\n", 3},
	}
	for _, c := range cases {
		_, err := foundry.ParsePipeline(c.text)
		var syntax *foundry.SyntaxError
		if !errors.As(err, &syntax) || syntax.Lineno != c.line {
			t.Errorf("expected a syntax error on line %d for %q, got %v", c.line, c.text, err)
		}
	}
}

func TestPhase1UnknownDependencyIsRejected(t *testing.T) {
	_, err := foundry.LoadPipeline("build:\n  duration: 1\n  after: compile\n")
	var pipelineErr *foundry.PipelineError
	if !errors.As(err, &pipelineErr) || !strings.Contains(err.Error(), "compile") {
		t.Fatalf("got %v, want a PipelineError that names compile", err)
	}
}

func TestPhase1CycleErrorShowsTheLoop(t *testing.T) {
	_, err := foundry.LoadPipeline(loop)
	var cycleErr *foundry.CycleError
	if !errors.As(err, &cycleErr) {
		t.Fatalf("expected a CycleError, got %v", err)
	}
	cycle := cycleErr.Cycle
	if cycle[0] != cycle[len(cycle)-1] {
		t.Errorf("a cycle ends where it starts: %v", cycle)
	}
	members := append([]string(nil), cycle[:len(cycle)-1]...)
	sort.Strings(members)
	if !reflect.DeepEqual(members, []string{"a", "b", "c"}) {
		t.Errorf("cycle members = %v, want a, b and c", members)
	}
	if !strings.Contains(err.Error(), strings.Join(cycle, " -> ")) {
		t.Errorf("message %q does not show the loop %v", err.Error(), cycle)
	}
}

func TestPhase1DiamondIsNotACycle(t *testing.T) {
	order := load(t, diamond).TopologicalOrder()
	if order[0] != "checkout" || order[len(order)-1] != "bundle" {
		t.Fatalf("order = %v, want checkout first and bundle last", order)
	}
}

func TestPhase1DependenciesMayBeDefinedLater(t *testing.T) {
	graph := load(t, "ship:\n  duration: 1\n  after: build\nbuild:\n  duration: 2\n")
	if got := graph.TopologicalOrder(); !reflect.DeepEqual(got, []string{"build", "ship"}) {
		t.Fatalf("order = %v, want [build ship]", got)
	}
}

func TestPhase1WebAppTopologicalOrder(t *testing.T) {
	want := []string{"install", "seed-db", "compile", "lint", "unit-tests", "e2e-tests", "package", "deploy"}
	if got := load(t, foundry.WebApp).TopologicalOrder(); !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
}

func TestPhase1WebAppSerialPlanRespectsDependencies(t *testing.T) {
	graph := load(t, foundry.WebApp)
	plan := foundry.SerialSchedule(graph)
	assertRespectsDependencies(t, graph, plan)
	if plan.Makespan() != 26 {
		t.Fatalf("makespan = %d, want 26", plan.Makespan())
	}
}

func TestPhase1MobileReleaseSerialPlanRespectsDependencies(t *testing.T) {
	graph := load(t, foundry.MobileRelease)
	plan := foundry.SerialSchedule(graph)
	assertRespectsDependencies(t, graph, plan)
	publish := plan.SlotFor("publish")
	for _, dep := range []string{"sign-apk", "sign-ipa", "ui-tests", "unit-tests"} {
		if publish.Start < plan.SlotFor(dep).End {
			t.Errorf("publish started at %d, before %s finished", publish.Start, dep)
		}
	}
	if publish.End != 34 {
		t.Errorf("publish ends at %d; it must be the last step, at 34", publish.End)
	}
}

func TestPhase1WebAppCriticalPath(t *testing.T) {
	want := foundry.CriticalPath{Minutes: 16, Path: []string{"install", "compile", "unit-tests", "package", "deploy"}}
	if got := load(t, foundry.WebApp).CriticalPath(); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestPhase1MobileReleaseCriticalPath(t *testing.T) {
	want := foundry.CriticalPath{Minutes: 21, Path: []string{"fetch-deps", "build-ios", "ui-tests", "publish"}}
	if got := load(t, foundry.MobileRelease).CriticalPath(); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestPhase1GanttChartRows(t *testing.T) {
	graph := load(t, release)
	chart := strings.Split(foundry.RenderGantt(foundry.SerialSchedule(graph), graph), "\n")
	if len(chart) != 5 {
		t.Fatalf("got %d lines, want 5: axis, one row per task, summary", len(chart))
	}
	if want := "build    r0   |====    | 0-4  [linux]"; chart[1] != want {
		t.Errorf("row 1 = %q, want %q", chart[1], want)
	}
	if want := "release  r0   |       =| 7-8"; chart[3] != want {
		t.Errorf("row 3 = %q, want %q", chart[3], want)
	}
	if !strings.Contains(chart[len(chart)-1], "makespan 8 min") {
		t.Errorf("summary line = %q, want makespan 8 min", chart[len(chart)-1])
	}
}
