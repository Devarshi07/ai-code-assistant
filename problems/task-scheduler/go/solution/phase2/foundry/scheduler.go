// Turns a dependency graph into a Plan of runner assignments.
package foundry

import (
	"errors"
	"sort"
)

// SerialSchedule is today's behaviour: one runner, tasks back to back in
// topological order.
func SerialSchedule(graph *DependencyGraph) *Plan {
	var slots []Slot
	clock := 0
	for _, name := range graph.TopologicalOrder() {
		duration := graph.Get(name).Duration
		slots = append(slots, Slot{Task: name, Worker: 0, Start: clock, End: clock + duration})
		clock += duration
	}
	return NewPlan(1, slots)
}

// RemainingPaths gives each task's priority: its duration plus the longest
// remaining path of any task that depends on it. Dependents come first in
// reverse topological order, so one backward pass is enough.
func RemainingPaths(graph *DependencyGraph) map[string]int {
	longest := make(map[string]int, graph.Size())
	order := graph.TopologicalOrder()
	for i := len(order) - 1; i >= 0; i-- {
		name := order[i]
		tail := 0
		for _, child := range graph.Dependents(name) {
			tail = max(tail, longest[child])
		}
		longest[name] = graph.Get(name).Duration + tail
	}
	return longest
}

// Schedule plans the pipeline on `workers` identical runners.
//
// It uses the list-scheduling policy described under "Parallel runners" in
// README.md: whenever a runner is idle, it starts the ready task with the
// highest priority. The plan has one slot per task.
//
// Event by event: finish everything ending now, rescan the waiting tasks for
// ready ones, hand them out by priority, then jump to the next finish.
func Schedule(graph *DependencyGraph, workers int) (*Plan, error) {
	if workers < 1 {
		return nil, errors.New("schedule needs at least one runner")
	}
	priority := RemainingPaths(graph)
	waiting := graph.Names() // tasks that have not started yet
	finished := map[string]bool{}
	var running []Slot // slots in progress
	var idle []int
	for w := 0; w < workers; w++ {
		idle = append(idle, w)
	}
	var slots []Slot
	clock := 0
	for len(waiting) > 0 || len(running) > 0 {
		var stillRunning []Slot
		for _, s := range running {
			if s.End == clock {
				finished[s.Task] = true
				idle = append(idle, s.Worker)
			} else {
				stillRunning = append(stillRunning, s)
			}
		}
		running = stillRunning
		var ready []string
		for _, name := range waiting {
			ok := true
			for _, dep := range graph.Get(name).Deps {
				if !finished[dep] {
					ok = false
					break
				}
			}
			if ok {
				ready = append(ready, name)
			}
		}
		sort.Slice(ready, func(i, j int) bool {
			a, b := ready[i], ready[j]
			if priority[a] != priority[b] {
				return priority[a] > priority[b]
			}
			return a < b
		})
		sort.Ints(idle)
		count := min(len(ready), len(idle))
		started := make(map[string]bool, count)
		for i := 0; i < count; i++ {
			s := Slot{Task: ready[i], Worker: idle[i], Start: clock, End: clock + graph.Get(ready[i]).Duration}
			slots = append(slots, s)
			running = append(running, s)
			started[ready[i]] = true
		}
		idle = idle[count:]
		if count > 0 {
			var rest []string
			for _, name := range waiting {
				if !started[name] {
					rest = append(rest, name)
				}
			}
			waiting = rest
		}
		if len(running) > 0 {
			clock = running[0].End
			for _, s := range running {
				clock = min(clock, s.End)
			}
		}
	}
	return NewPlan(workers, slots), nil
}
