// Package foundry parses CI pipeline files, validates the dependency graph and
// plans runs across runners.
package foundry

import (
	"fmt"
	"regexp"
	"strings"
)

var namePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)

// PipelineError means a pipeline definition is invalid: bad syntax, unknown
// task, cycle, ...
type PipelineError struct {
	Message string
}

func (e *PipelineError) Error() string { return e.Message }

func pipelineErrorf(format string, args ...any) *PipelineError {
	return &PipelineError{Message: fmt.Sprintf(format, args...)}
}

// Task is a unit of work such as compiling the app or running a test suite.
//
//	Duration  whole minutes the task keeps one runner busy (at least 1)
//	Deps      names of the tasks that must finish before this one may start
//	Resource  optional runner label such as "macos" ("" if none); informational
type Task struct {
	Name     string
	Duration int
	Deps     []string
	Resource string
}

// NewTask validates and builds a Task. Repeated dependencies are dropped; the
// order given is kept.
func NewTask(name string, duration int, deps []string, resource string) (*Task, error) {
	if !namePattern.MatchString(name) {
		return nil, pipelineErrorf("invalid task name %q", name)
	}
	if duration < 1 {
		return nil, pipelineErrorf("%s: duration must be a whole number of minutes, at least 1", name)
	}
	seen := make(map[string]bool, len(deps))
	unique := make([]string, 0, len(deps))
	for _, dep := range deps {
		if !seen[dep] {
			seen[dep] = true
			unique = append(unique, dep)
		}
	}
	return &Task{Name: name, Duration: duration, Deps: unique, Resource: resource}, nil
}

func (t *Task) String() string {
	after, on := "", ""
	if len(t.Deps) > 0 {
		after = " after " + strings.Join(t.Deps, ", ")
	}
	if t.Resource != "" {
		on = " on " + t.Resource
	}
	return fmt.Sprintf("%s (%d min)%s%s", t.Name, t.Duration, after, on)
}
