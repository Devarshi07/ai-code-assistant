package maze

// Route finding over Level grids.

import (
	"math"
	"slices"
)

// Run is a complete route through a level.
type Run struct {
	Path  []Position // every tile visited, start and exit inclusive
	Moves int        // number of steps, always len(Path) - 1
}

// ShortestPath runs a breadth-first search from source to target. It returns
// the positions from source to target inclusive, or nil when the target
// cannot be reached.
func ShortestPath(level *Level, source, target Position) []Position {
	if source == target {
		return []Position{source}
	}
	cameFrom := map[Position]Position{source: source}
	queue := []Position{source}
	for head := 0; head < len(queue); head++ {
		current := queue[head]
		for _, next := range level.MovesFrom(current) {
			if _, seen := cameFrom[next]; seen {
				continue
			}
			cameFrom[next] = current
			if next == target {
				return rebuild(cameFrom, source, target)
			}
			queue = append(queue, next)
		}
	}
	return nil
}

// rebuild follows the parent links back from target to source.
func rebuild(cameFrom map[Position]Position, source, target Position) []Position {
	path := []Position{target}
	for at := target; at != source; {
		at = cameFrom[at]
		path = append(path, at)
	}
	slices.Reverse(path)
	return path
}

// Solve finds the shortest route from the start tile to the exit, ignoring
// gems. It returns nil when the exit cannot be reached.
func Solve(level *Level) *Run {
	path := ShortestPath(level, level.Start, level.Exit)
	if path == nil {
		return nil
	}
	return &Run{Path: path, Moves: len(path) - 1}
}

// CollectAllGems finds the shortest route from the start tile to the exit
// that steps on every gem. It returns nil when a gem or the exit cannot be
// reached.
//
// It computes the shortest leg between every pair of stops, then tries every
// order of gems. Legs are directional because gates are one-way.
func CollectAllGems(level *Level) *Run {
	stops := append(append([]Position{level.Start}, level.Gems...), level.Exit)
	// legs[a][b] is the shortest path from stop a to stop b, or nil.
	legs := make([][][]Position, len(stops))
	for a := range stops {
		legs[a] = make([][]Position, len(stops))
		for b := range stops {
			legs[a][b] = ShortestPath(level, stops[a], stops[b])
		}
	}
	exit := len(stops) - 1
	gemCount := len(level.Gems)
	used := make([]bool, gemCount+1)
	order := make([]int, 0, gemCount)
	bestTotal := math.MaxInt
	var bestOrder []int

	var visit func(last, total int)
	visit = func(last, total int) {
		if len(order) == gemCount {
			if tail := legs[last][exit]; tail != nil && total+len(tail)-1 < bestTotal {
				bestTotal = total + len(tail) - 1
				bestOrder = slices.Clone(order)
			}
			return
		}
		for gem := 1; gem <= gemCount; gem++ {
			leg := legs[last][gem]
			if used[gem] || leg == nil {
				continue
			}
			used[gem] = true
			order = append(order, gem)
			visit(gem, total+len(leg)-1)
			order = order[:len(order)-1]
			used[gem] = false
		}
	}

	visit(0, 0)
	if bestTotal == math.MaxInt {
		return nil
	}
	route := append(append([]int{0}, bestOrder...), exit)
	path := []Position{level.Start}
	for i := 1; i < len(route); i++ {
		path = append(path, legs[route[i-1]][route[i]][1:]...)
	}
	return &Run{Path: path, Moves: len(path) - 1}
}
