// Turns a dependency graph into a Plan of runner assignments.
package foundry

import "errors"

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

// Schedule plans the pipeline on `workers` identical runners.
//
// It uses the list-scheduling policy described under "Parallel runners" in
// README.md: whenever a runner is idle, it starts the ready task with the
// highest priority. The plan has one slot per task.
func Schedule(graph *DependencyGraph, workers int) (*Plan, error) {
	return nil, errors.New("phase 2: Schedule is not implemented")
}
