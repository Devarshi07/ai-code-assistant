package maze

// Route finding over Level grids.

import (
	"math"
	"slices"
)

// unreachable is the leg length for a stop that cannot be reached. It is
// large, but two of them still add up without overflowing.
const unreachable = math.MaxInt / 4

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

// searchFrom runs a breadth-first search over the whole level. It maps every
// reachable tile to the tile it was reached from; source maps to itself.
func searchFrom(level *Level, source Position) map[Position]Position {
	cameFrom := map[Position]Position{source: source}
	queue := []Position{source}
	for head := 0; head < len(queue); head++ {
		for _, next := range level.MovesFrom(queue[head]) {
			if _, seen := cameFrom[next]; !seen {
				cameFrom[next] = queue[head]
				queue = append(queue, next)
			}
		}
	}
	return cameFrom
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
// One BFS per stop gives every directional leg. A Held-Karp dynamic program
// over subsets of gems then finds the best order in O(2^k * k^2).
func CollectAllGems(level *Level) *Run {
	gems := level.Gems
	k := len(gems)
	if k == 0 {
		return Solve(level)
	}
	sources := append([]Position{level.Start}, gems...)
	trees := make([]map[Position]Position, len(sources))
	for i, source := range sources {
		trees[i] = searchFrom(level, source)
	}
	legPath := func(from int, target Position) []Position {
		if _, ok := trees[from][target]; !ok {
			return nil
		}
		return rebuild(trees[from], sources[from], target)
	}
	legLength := func(from int, target Position) int {
		if path := legPath(from, target); path != nil {
			return len(path) - 1
		}
		return unreachable
	}
	// toGem[i][j]: source i (0 = start, 1..k = gems) to gem j (0-based).
	toGem := make([][]int, k+1)
	toExit := make([]int, k+1)
	for i := range sources {
		toGem[i] = make([]int, k)
		for j, gem := range gems {
			toGem[i][j] = legLength(i, gem)
		}
		toExit[i] = legLength(i, level.Exit)
	}

	full := 1<<k - 1
	best := make([][]int, 1<<k)
	parent := make([][]int, 1<<k)
	for mask := range best {
		best[mask] = make([]int, k)
		parent[mask] = make([]int, k)
		for j := range k {
			best[mask][j] = unreachable
			parent[mask][j] = -1
		}
	}
	for j := range k {
		best[1<<j][j] = toGem[0][j]
	}
	for mask := 1; mask <= full; mask++ {
		row := best[mask]
		for last := range k {
			here := row[last]
			if here >= unreachable {
				continue
			}
			legs := toGem[last+1]
			for next := range k {
				bit := 1 << next
				if mask&bit != 0 || legs[next] >= unreachable {
					continue
				}
				if cost := here + legs[next]; cost < best[mask|bit][next] {
					best[mask|bit][next] = cost
					parent[mask|bit][next] = last
				}
			}
		}
	}

	bestTotal, bestLast := unreachable, -1
	for last := range k {
		if total := best[full][last] + toExit[last+1]; total < bestTotal {
			bestTotal, bestLast = total, last
		}
	}
	if bestLast < 0 {
		return nil
	}

	var order []int
	for mask, last := full, bestLast; last >= 0; {
		order = append(order, last)
		previous := parent[mask][last]
		mask ^= 1 << last
		last = previous
	}
	slices.Reverse(order)

	path := []Position{level.Start}
	from := 0
	for _, gem := range order {
		path = append(path, legPath(from, gems[gem])[1:]...)
		from = gem + 1
	}
	path = append(path, legPath(from, level.Exit)[1:]...)
	return &Run{Path: path, Moves: len(path) - 1}
}
