package tests

// Deterministic pipeline generator for the scale tests (xorshift32 PRNG). It
// is the same generator as the other language versions, so a seed always gives
// the same tasks.

import (
	"fmt"
	"slices"

	"debuggym/task-scheduler/foundry"
)

var kinds = []string{"build", "test", "lint", "pack", "scan", "docs", "bench", "deploy"}

// xorshift32 is a small 32-bit PRNG.
type xorshift32 uint32

func newXorshift32(seed uint32) *xorshift32 {
	if seed == 0 {
		seed = 0x9e3779b9
	}
	state := xorshift32(seed)
	return &state
}

func (s *xorshift32) next() uint32 {
	x := uint32(*s)
	x ^= x << 13
	x ^= x >> 17
	x ^= x << 5
	*s = xorshift32(x)
	return x
}

func (s *xorshift32) below(n int) int { return int(s.next() % uint32(n)) }

// generatePipeline makes `count` tasks; each depends on up to maxDeps of the
// `window` tasks before it.
func generatePipeline(seed uint32, count, window, maxDeps, maxDuration int) []*foundry.Task {
	rng := newXorshift32(seed)
	names := make([]string, 0, count)
	tasks := make([]*foundry.Task, 0, count)
	for i := 0; i < count; i++ {
		name := fmt.Sprintf("%s-%d", kinds[rng.below(len(kinds))], i)
		var deps []string
		if i > 0 {
			low := max(0, i-window)
			k := rng.below(maxDeps + 1)
			for j := 0; j < k; j++ {
				dep := names[low+rng.below(i-low)]
				if !slices.Contains(deps, dep) {
					deps = append(deps, dep)
				}
			}
		}
		task, err := foundry.NewTask(name, 1+rng.below(maxDuration), deps, "")
		if err != nil {
			panic(err)
		}
		tasks = append(tasks, task)
		names = append(names, name)
	}
	return tasks
}

// fingerprint folds every task's (start, runner) into one number, in
// generation order.
func fingerprint(tasks []*foundry.Task, plan *foundry.Plan) int64 {
	var acc int64
	for _, task := range tasks {
		s := plan.SlotFor(task.Name)
		acc = (acc*1000003 + int64(s.Start)*1024 + int64(s.Worker)) % 2147483647
	}
	return acc
}
