// Dependency graph utilities: validation, cycle detection, ordering.
package foundry

import "strings"

// CycleError means the pipeline's dependencies loop back on themselves.
type CycleError struct {
	// Cycle is one loop as [a, b, ..., a].
	Cycle []string
}

func (e *CycleError) Error() string { return "dependency cycle: " + strings.Join(e.Cycle, " -> ") }

// Unwrap lets errors.As find the PipelineError a cycle error is a kind of.
func (e *CycleError) Unwrap() error { return &PipelineError{Message: e.Error()} }

// CriticalPath is the longest chain of work and how long it takes.
type CriticalPath struct {
	Minutes int
	Path    []string
}

// DependencyGraph is a validated, acyclic set of tasks.
//
//	graph.Get("compile")         the Task named compile
//	graph.Dependents("compile")  names of the tasks that list compile in `after`
//	graph.Tasks()                the tasks in definition order
type DependencyGraph struct {
	tasks      map[string]*Task
	order      []string // names in definition order
	dependents map[string][]string
}

// NewDependencyGraph validates tasks into a graph: no duplicates, no unknown
// or self dependencies, no cycles.
func NewDependencyGraph(tasks []*Task) (*DependencyGraph, error) {
	g := &DependencyGraph{tasks: map[string]*Task{}, dependents: map[string][]string{}}
	for _, task := range tasks {
		if _, dup := g.tasks[task.Name]; dup {
			return nil, pipelineErrorf("task '%s' is defined twice", task.Name)
		}
		g.tasks[task.Name] = task
		g.order = append(g.order, task.Name)
	}
	for _, name := range g.order {
		g.dependents[name] = nil
	}
	for _, name := range g.order {
		task := g.tasks[name]
		for _, dep := range task.Deps {
			if dep == task.Name {
				return nil, pipelineErrorf("task '%s' depends on itself", task.Name)
			}
			if _, ok := g.tasks[dep]; !ok {
				return nil, pipelineErrorf("task '%s' depends on unknown task '%s'", task.Name, dep)
			}
			g.dependents[dep] = append(g.dependents[dep], task.Name)
		}
	}
	deps := make(map[string][]string, len(g.tasks))
	for name, task := range g.tasks {
		deps[name] = task.Deps
	}
	if cycle := FindCycle(g.order, deps); cycle != nil {
		return nil, &CycleError{Cycle: cycle}
	}
	return g, nil
}

// Size is the number of tasks.
func (g *DependencyGraph) Size() int { return len(g.order) }

// Has reports whether a task with this name exists.
func (g *DependencyGraph) Has(name string) bool { _, ok := g.tasks[name]; return ok }

// Get returns the task with this name, or nil.
func (g *DependencyGraph) Get(name string) *Task { return g.tasks[name] }

// Names lists the task names in definition order.
func (g *DependencyGraph) Names() []string { return append([]string(nil), g.order...) }

// Tasks lists the tasks in definition order.
func (g *DependencyGraph) Tasks() []*Task {
	tasks := make([]*Task, len(g.order))
	for i, name := range g.order {
		tasks[i] = g.tasks[name]
	}
	return tasks
}

// Dependents lists the tasks that name `name` in their `after` setting.
func (g *DependencyGraph) Dependents(name string) []string { return g.dependents[name] }

// TopologicalOrder lists task names, each after all of its dependencies.
// Kahn's algorithm with a FIFO queue seeded in definition order, so the result
// is deterministic.
func (g *DependencyGraph) TopologicalOrder() []string {
	waiting := make(map[string]int, len(g.tasks))
	var queue []string
	for _, name := range g.order {
		count := len(g.tasks[name].Deps)
		waiting[name] = count
		if count == 0 {
			queue = append(queue, name)
		}
	}
	for head := 0; head < len(queue); head++ {
		for _, child := range g.dependents[queue[head]] {
			waiting[child]--
			if waiting[child] == 0 {
				queue = append(queue, child)
			}
		}
	}
	return queue
}

// CriticalPath finds the longest chain of work. No number of runners can
// finish the pipeline faster than this.
func (g *DependencyGraph) CriticalPath() CriticalPath {
	order := g.TopologicalOrder()
	finish := make(map[string]int, len(order))
	via := make(map[string]string, len(order))
	for _, name := range order {
		start, before := 0, ""
		for _, dep := range g.tasks[name].Deps {
			if finish[dep] > start {
				start = finish[dep]
				before = dep
			}
		}
		finish[name] = start + g.tasks[name].Duration
		via[name] = before
	}
	last := ""
	for _, name := range order {
		if last == "" || finish[name] > finish[last] {
			last = name
		}
	}
	var path []string
	for name := last; name != ""; name = via[name] {
		path = append(path, name)
	}
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}
	minutes := 0
	if len(path) > 0 {
		minutes = finish[path[len(path)-1]]
	}
	return CriticalPath{Minutes: minutes, Path: path}
}

// FindCycle returns one cycle in a name -> dependencies map as [a, b, ..., a],
// or nil. `names` fixes the order the roots are tried in. Iterative
// depth-first search, so very deep pipelines can't overflow the stack. A
// dependency still on the current trail closes a loop.
func FindCycle(names []string, deps map[string][]string) []string {
	done := map[string]bool{}
	onTrail := map[string]bool{}
	for _, root := range names {
		if done[root] {
			continue
		}
		trail := []string{root}
		next := []int{0} // next[i]: position of trail[i]'s next dependency
		onTrail[root] = true
		for len(trail) > 0 {
			top := len(trail) - 1
			list := deps[trail[top]]
			if next[top] == len(list) {
				finished := trail[top]
				trail, next = trail[:top], next[:top]
				delete(onTrail, finished)
				done[finished] = true
				continue
			}
			dep := list[next[top]]
			next[top]++
			if onTrail[dep] {
				start := 0
				for trail[start] != dep {
					start++
				}
				return append(append([]string(nil), trail[start:]...), dep)
			}
			if !done[dep] {
				trail = append(trail, dep)
				next = append(next, 0)
				onTrail[dep] = true
			}
		}
	}
	return nil
}

// LoadPipeline parses pipeline text and validates it into a DependencyGraph.
func LoadPipeline(text string) (*DependencyGraph, error) {
	tasks, err := ParsePipeline(text)
	if err != nil {
		return nil, err
	}
	return NewDependencyGraph(tasks)
}
