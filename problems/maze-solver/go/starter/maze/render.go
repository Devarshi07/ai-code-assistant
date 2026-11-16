package maze

// Text rendering used by the level editor preview and the CLI.

import (
	"fmt"
	"strings"
)

// PathMark marks the floor tiles a route walks over in a preview.
const PathMark = 'o'

// Render returns the level as text with the floor tiles on path marked.
func Render(level *Level, path []Position) string {
	grid := make([][]byte, len(level.Rows))
	for r, row := range level.Rows {
		grid[r] = []byte(row)
	}
	for _, pos := range path {
		if grid[pos.Row][pos.Col] == floor {
			grid[pos.Row][pos.Col] = PathMark
		}
	}
	lines := make([]string, len(grid))
	for r, row := range grid {
		lines[r] = string(row)
	}
	return strings.Join(lines, "\n")
}

// ToMoves describes a path as compass letters, such as "EESSW".
func ToMoves(path []Position) string {
	var moves strings.Builder
	for i := 1; i < len(path); i++ {
		moves.WriteString(DirectionBetween(path[i-1], path[i]).String())
	}
	return moves.String()
}

// Summary is the line printed for a level: its name, the number of moves and
// the route as compass letters.
func Summary(level *Level, run *Run) string {
	if run == nil {
		return level.Name + ": no route"
	}
	return fmt.Sprintf("%s: %d moves  %s", level.Name, run.Moves, ToMoves(run.Path))
}
