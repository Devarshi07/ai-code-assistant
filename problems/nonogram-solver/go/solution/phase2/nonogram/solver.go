package nonogram

// Solver used by the import pipeline to build answer keys for contributor puzzles.

// linePlacements lists every way to lay out clue's blocks in a line of length cells.
func linePlacements(clue []int, length int) [][]int {
	if len(clue) == 0 {
		return [][]int{make([]int, length)}
	}
	first, rest := clue[0], clue[1:]
	tailMin := Sum(rest) + len(rest) // later blocks plus the gap before each
	var placements [][]int
	for start := 0; start+first+tailMin <= length; start++ {
		headLength := start + first
		if len(rest) == 0 {
			line := make([]int, length)
			for i := start; i < headLength; i++ {
				line[i] = Filled
			}
			placements = append(placements, line)
			continue
		}
		for _, tail := range linePlacements(rest, length-headLength-1) {
			line := make([]int, length)
			for i := start; i < headLength; i++ {
				line[i] = Filled
			}
			copy(line[headLength+1:], tail)
			placements = append(placements, line)
		}
	}
	return placements
}

// roomNeeded returns needed, where needed[b] is the cells required to fit
// blocks b.. of clue, with gaps between them.
func roomNeeded(clue []int) []int {
	needed := make([]int, len(clue)+1)
	for b := len(clue) - 1; b >= 0; b-- {
		needed[b] = clue[b] + needed[b+1]
		if b+1 < len(clue) {
			needed[b]++
		}
	}
	return needed
}

// Solve returns a grid that satisfies every row and column clue of p.
//
// The grid has p.Height rows of p.Width cells each (Filled or Empty). It
// returns nil when no grid fits the clues.
//
// Row-by-row backtracking: try every placement of each row's clue and keep a
// running state per column (blocks finished, length of the open block) so a
// row is rejected as soon as some column prefix can no longer match.
func Solve(p *Puzzle) Grid {
	options := make([][][]int, p.Height)
	for r, clue := range p.RowClues {
		options[r] = linePlacements(clue, p.Width)
	}
	needed := make([][]int, p.Width)
	for c, clue := range p.ColClues {
		needed[c] = roomNeeded(clue)
	}
	grid := make(Grid, 0, p.Height)
	// One column-state buffer per row depth, so the search allocates nothing per placement.
	blockStates := make([][]int, p.Height+1)
	runStates := make([][]int, p.Height+1)
	for depth := range blockStates {
		blockStates[depth] = make([]int, p.Width)
		runStates[depth] = make([]int, p.Width)
	}

	// advance fills the column states for depth r+1 from those at depth r after
	// adding row, and reports false if some column is now impossible.
	advance := func(r int, row []int) bool {
		rowsLeft := p.Height - r - 1
		for c := range p.Width {
			clue := p.ColClues[c]
			b, run := blockStates[r][c], runStates[r][c]
			if row[c] == Filled {
				run++
				if b >= len(clue) || run > clue[b] {
					return false
				}
			} else if run > 0 {
				if run != clue[b] {
					return false
				}
				b++
				run = 0
			}
			if needed[c][b]-run > rowsLeft { // not enough rows left for this column
				return false
			}
			blockStates[r+1][c], runStates[r+1][c] = b, run
		}
		return true
	}

	var place func(r int) bool
	place = func(r int) bool {
		if r == p.Height {
			return true
		}
		for _, row := range options[r] {
			if !advance(r, row) {
				continue
			}
			grid = append(grid, row)
			if place(r + 1) {
				return true
			}
			grid = grid[:len(grid)-1]
		}
		return false
	}

	if !place(0) {
		return nil
	}
	result := make(Grid, len(grid))
	for r, row := range grid {
		result[r] = append([]int(nil), row...)
	}
	return result
}
