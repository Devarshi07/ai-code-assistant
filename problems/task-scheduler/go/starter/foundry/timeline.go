// Plans (which runner does what, and when) and a text Gantt chart.
package foundry

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Slot is one task's place in a plan.
// Task: task name; Worker: runner index from 0; Start: minute it starts;
// End: minute it finishes (Start + duration).
type Slot struct {
	Task   string
	Worker int
	Start  int
	End    int
}

// Plan is a set of slots on `Workers` identical runners, kept sorted by
// (Start, Worker).
type Plan struct {
	Workers int
	Slots   []Slot
	byTask  map[string]int
}

// NewPlan sorts the slots and indexes them by task name.
func NewPlan(workers int, slots []Slot) *Plan {
	sorted := append([]Slot(nil), slots...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].Start != sorted[j].Start {
			return sorted[i].Start < sorted[j].Start
		}
		return sorted[i].Worker < sorted[j].Worker
	})
	byTask := make(map[string]int, len(sorted))
	for i, s := range sorted {
		byTask[s.Task] = i
	}
	return &Plan{Workers: workers, Slots: sorted, byTask: byTask}
}

// Size is the number of slots.
func (p *Plan) Size() int { return len(p.Slots) }

// SlotFor returns the slot of the named task, or nil if it is not in the plan.
func (p *Plan) SlotFor(name string) *Slot {
	if i, ok := p.byTask[name]; ok {
		return &p.Slots[i]
	}
	return nil
}

// Makespan is the minutes from the start of the pipeline until its last task
// finishes.
func (p *Plan) Makespan() int {
	latest := 0
	for _, s := range p.Slots {
		if s.End > latest {
			latest = s.End
		}
	}
	return latest
}

// BusyMinutes totals the minutes runners spend working.
func (p *Plan) BusyMinutes() int {
	total := 0
	for _, s := range p.Slots {
		total += s.End - s.Start
	}
	return total
}

// BusyPercent is the share of runner time spent working, rounded down.
func (p *Plan) BusyPercent() int {
	capacity := p.Workers * p.Makespan()
	if capacity == 0 {
		return 0
	}
	return p.BusyMinutes() * 100 / capacity
}

const ganttWidth = 48

func padEnd(s string, width int) string {
	if len(s) >= width {
		return s
	}
	return s + strings.Repeat(" ", width-len(s))
}

// RenderGantt draws one row per task: name, runner, a bar on a shared
// timeline, times. Each column covers `scale` minutes, chosen so the bars fit
// in 48 columns. Pass the graph to show each task's resource label (or nil).
func RenderGantt(plan *Plan, graph *DependencyGraph) string {
	if len(plan.Slots) == 0 {
		return "(empty schedule)"
	}
	span := plan.Makespan()
	scale := (span + ganttWidth - 1) / ganttWidth // minutes per column, rounded up
	columns := (span + scale - 1) / scale
	label := 0
	for _, s := range plan.Slots {
		label = max(label, len(s.Task))
	}
	axis := ""
	for col := 0; col <= columns; col += 10 {
		axis = padEnd(axis, col) + strconv.Itoa(col*scale)
	}
	lines := []string{strings.Repeat(" ", label+8) + axis}
	for _, s := range plan.Slots {
		first := s.Start / scale
		last := max(first+1, (s.End+scale-1)/scale)
		bar := strings.Repeat(" ", first) + strings.Repeat("=", last-first) + strings.Repeat(" ", columns-last)
		row := fmt.Sprintf("%s  r%s |%s| %d-%d", padEnd(s.Task, label), padEnd(strconv.Itoa(s.Worker), 3), bar, s.Start, s.End)
		if graph != nil {
			if resource := graph.Get(s.Task).Resource; resource != "" {
				row += "  [" + resource + "]"
			}
		}
		lines = append(lines, row)
	}
	lines = append(lines, fmt.Sprintf("makespan %d min on %d runner(s), %d%% busy", span, plan.Workers, plan.BusyPercent()))
	return strings.Join(lines, "\n")
}
