// Command main prints the solver's routes for the sample levels.
package main

import (
	"fmt"

	"debuggym/maze-solver/maze"
)

func main() {
	for _, level := range maze.LoadSamples() {
		run := maze.Solve(level)
		fmt.Println(maze.Summary(level, run))
		var path []maze.Position
		if run != nil {
			path = run.Path
		}
		fmt.Println(maze.Render(level, path))
		if len(level.Gems) > 0 {
			fmt.Println("  gem run:", gemRun(level))
		}
		fmt.Println()
	}
}

// gemRun describes the fewest moves that collect every gem. While the solver
// is unfinished it panics, and the demo prints the message instead.
func gemRun(level *maze.Level) (text string) {
	defer func() {
		if r := recover(); r != nil {
			text = fmt.Sprint(r)
		}
	}()
	if run := maze.CollectAllGems(level); run != nil {
		return fmt.Sprintf("%d moves", run.Moves)
	}
	return "impossible moves"
}
