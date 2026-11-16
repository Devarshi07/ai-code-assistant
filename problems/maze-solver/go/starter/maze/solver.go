package maze

// Route finding over Level grids.

import "slices"

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
func CollectAllGems(level *Level) *Run {
	panic("phase 2: CollectAllGems is not implemented yet")
}
