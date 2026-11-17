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

// heap is a binary min-heap; less(a, b) is true when a should come out first.
type heap[T any] struct {
	less  func(a, b T) bool
	items []T
}

func newHeap[T any](less func(a, b T) bool, items []T) *heap[T] {
	h := &heap[T]{less: less, items: items}
	for i := len(items)/2 - 1; i >= 0; i-- {
		h.siftDown(i)
	}
	return h
}

func (h *heap[T]) size() int { return len(h.items) }

func (h *heap[T]) peek() T { return h.items[0] }

func (h *heap[T]) push(item T) {
	h.items = append(h.items, item)
	i := len(h.items) - 1
	for i > 0 {
		parent := (i - 1) / 2
		if !h.less(h.items[i], h.items[parent]) {
			break
		}
		h.items[i], h.items[parent] = h.items[parent], h.items[i]
		i = parent
	}
}

func (h *heap[T]) pop() T {
	top := h.items[0]
	last := len(h.items) - 1
	h.items[0] = h.items[last]
	h.items = h.items[:last]
	if last > 0 {
		h.siftDown(0)
	}
	return top
}

func (h *heap[T]) siftDown(i int) {
	for {
		left := 2*i + 1
		right := left + 1
		best := i
		if left < len(h.items) && h.less(h.items[left], h.items[best]) {
			best = left
		}
		if right < len(h.items) && h.less(h.items[right], h.items[best]) {
			best = right
		}
		if best == i {
			return
		}
		h.items[i], h.items[best] = h.items[best], h.items[i]
		i = best
	}
}

// Schedule plans the pipeline on `workers` identical runners.
//
// It uses the list-scheduling policy described under "Parallel runners" in
// README.md: whenever a runner is idle, it starts the ready task with the
// highest priority. The plan has one slot per task.
//
// Event-driven with three heaps, O((n + e) log n) overall:
//
//	ready    tasks whose dependencies have all finished, best priority first
//	idle     runner ids, lowest first
//	running  slots in progress, soonest finish first
//
// `blockers` counts each task's unfinished dependencies (Kahn's algorithm), so
// a finish only touches the dependents of the task that finished.
func Schedule(graph *DependencyGraph, workers int) (*Plan, error) {
	if workers < 1 {
		return nil, errors.New("schedule needs at least one runner")
	}
	priority := RemainingPaths(graph)
	blockers := make(map[string]int, graph.Size())
	var roots []string
	for _, task := range graph.Tasks() {
		blockers[task.Name] = len(task.Deps)
		if len(task.Deps) == 0 {
			roots = append(roots, task.Name)
		}
	}
	ready := newHeap(func(a, b string) bool {
		pa, pb := priority[a], priority[b]
		return pa > pb || (pa == pb && a < b)
	}, roots)
	runners := make([]int, workers)
	for w := range runners {
		runners[w] = w
	}
	idle := newHeap(func(a, b int) bool { return a < b }, runners)
	running := newHeap(func(a, b Slot) bool { return a.End < b.End }, nil)
	slots := make([]Slot, 0, graph.Size())
	clock := 0
	for ready.size() > 0 || running.size() > 0 {
		for ready.size() > 0 && idle.size() > 0 {
			name := ready.pop()
			s := Slot{Task: name, Worker: idle.pop(), Start: clock, End: clock + graph.Get(name).Duration}
			slots = append(slots, s)
			running.push(s)
		}
		clock = running.peek().End
		// Finish everything that ends at this minute before starting anything new.
		for running.size() > 0 && running.peek().End == clock {
			done := running.pop()
			idle.push(done.Worker)
			for _, child := range graph.Dependents(done.Task) {
				blockers[child]--
				if blockers[child] == 0 {
					ready.push(child)
				}
			}
		}
	}
	return NewPlan(workers, slots), nil
}
