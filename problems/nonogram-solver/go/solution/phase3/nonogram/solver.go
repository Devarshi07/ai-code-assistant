package nonogram

// Solver used by the import pipeline to build answer keys for contributor puzzles.
//
// Constraint propagation with a fallback search:
//
//  1. Line solving. For one row or column, a dynamic program finds every cell
//     that has the same value in all placements of the clue that agree with
//     the cells already known: O(length * blocks) per line instead of
//     enumerating placements.
//  2. Propagation. Lines are solved from a work queue; whenever a cell is
//     settled, the crossing line is queued again. This runs to a fixpoint.
//  3. Search. If cells are still unknown at the fixpoint, guess one,
//     propagate, and back out of the guess on contradiction.

// Unknown marks a cell that is not settled yet.
const Unknown = -1

// SolveLine settles every forced cell of one line.
//
// cells holds Filled, Empty or Unknown. It returns a new slice in which each
// Unknown cell that is the same in every consistent placement is set, or nil
// when no placement of clue agrees with the known cells.
func SolveLine(clue, cells []int) []int {
	n := len(cells)
	k := len(clue)
	empties := make([]int, n+1) // empties[i]: known-empty cells in cells[0:i]
	fills := make([]int, n+1)
	for i, cell := range cells {
		empties[i+1] = empties[i]
		fills[i+1] = fills[i]
		if cell == Empty {
			empties[i+1]++
		}
		if cell == Filled {
			fills[i+1]++
		}
	}

	// fwd[j][i]: cells[0:i] can hold exactly the first j blocks.
	fwd := make([][]bool, k+1)
	for j := range fwd {
		fwd[j] = make([]bool, n+1)
	}
	for i := 0; i <= n && fills[i] == 0; i++ {
		fwd[0][i] = true
	}
	for j := 1; j <= k; j++ {
		size := clue[j-1]
		row, prev := fwd[j], fwd[j-1]
		for i := size; i <= n; i++ {
			ok := row[i-1] && cells[i-1] != Filled // cell i-1 left empty
			if !ok && empties[i] == empties[i-size] { // block j ends at i
				s := i - size
				if j == 1 {
					ok = prev[s]
				} else {
					ok = s >= 1 && cells[s-1] != Filled && prev[s-1]
				}
			}
			row[i] = ok
		}
	}
	if !fwd[k][n] {
		return nil
	}

	// bwd[j][i]: cells[i:n] can hold exactly blocks j.. (last one included).
	bwd := make([][]bool, k+1)
	for j := range bwd {
		bwd[j] = make([]bool, n+2)
	}
	for i := n; i >= 0 && fills[n] == fills[i]; i-- {
		bwd[k][i] = true
	}
	for j := k - 1; j >= 0; j-- {
		size := clue[j]
		row, next := bwd[j], bwd[j+1]
		for i := n - size; i >= 0; i-- {
			ok := row[i+1] && cells[i] != Filled // cell i left empty
			if !ok && empties[i+size] == empties[i] { // block j starts at i
				e := i + size
				if j == k-1 {
					ok = next[e]
				} else {
					ok = e < n && cells[e] != Filled && next[e+1]
				}
			}
			row[i] = ok
		}
	}

	// A block can sit at [s, e) if the prefix fits the earlier blocks and the
	// suffix fits the later ones; mark the covered cells with a difference array.
	cover := make([]int, n+1)
	for j := range k {
		size := clue[j]
		left, right := fwd[j], bwd[j+1]
		for s := 0; s+size <= n; s++ {
			e := s + size
			if empties[e] != empties[s] {
				continue
			}
			if j == 0 {
				if !left[s] {
					continue
				}
			} else if s < 1 || cells[s-1] == Filled || !left[s-1] {
				continue
			}
			if j == k-1 {
				if !right[e] {
					continue
				}
			} else if e >= n || cells[e] == Filled || !right[e+1] {
				continue
			}
			cover[s]++
			cover[e]--
		}
	}

	settled := append([]int(nil), cells...)
	covered := 0
	for i := range n {
		covered += cover[i]
		if cells[i] != Unknown {
			continue
		}
		canBeEmpty := false
		for j := 0; j <= k && !canBeEmpty; j++ {
			canBeEmpty = fwd[j][i] && bwd[j][i+1]
		}
		switch {
		case covered > 0 && !canBeEmpty:
			settled[i] = Filled
		case canBeEmpty && covered == 0:
			settled[i] = Empty
		case covered == 0:
			return nil
		}
	}
	return settled
}

// propagate solves lines until nothing changes. It returns false on a contradiction.
func propagate(p *Puzzle, grid Grid, rows, cols []int) bool {
	type entry struct {
		isRow bool
		index int
	}
	var queue []entry
	rowQueued := make([]bool, p.Height)
	colQueued := make([]bool, p.Width)
	for _, r := range rows {
		rowQueued[r] = true
		queue = append(queue, entry{true, r})
	}
	for _, c := range cols {
		colQueued[c] = true
		queue = append(queue, entry{false, c})
	}
	for head := 0; head < len(queue); head++ {
		e := queue[head]
		if e.isRow {
			rowQueued[e.index] = false
			line := grid[e.index]
			settled := SolveLine(p.RowClues[e.index], line)
			if settled == nil {
				return false
			}
			for c := range p.Width {
				if settled[c] == line[c] {
					continue
				}
				line[c] = settled[c]
				if !colQueued[c] {
					colQueued[c] = true
					queue = append(queue, entry{false, c})
				}
			}
		} else {
			colQueued[e.index] = false
			line := make([]int, p.Height)
			for r := range grid {
				line[r] = grid[r][e.index]
			}
			settled := SolveLine(p.ColClues[e.index], line)
			if settled == nil {
				return false
			}
			for r := range p.Height {
				if settled[r] == line[r] {
					continue
				}
				grid[r][e.index] = settled[r]
				if !rowQueued[r] {
					rowQueued[r] = true
					queue = append(queue, entry{true, r})
				}
			}
		}
	}
	return true
}

func search(p *Puzzle, grid Grid, rows, cols []int) Grid {
	if !propagate(p, grid, rows, cols) {
		return nil
	}
	for r := range p.Height {
		for c := range p.Width {
			if grid[r][c] != Unknown {
				continue
			}
			for _, value := range []int{Filled, Empty} {
				trial := make(Grid, len(grid))
				for i, line := range grid {
					trial[i] = append([]int(nil), line...)
				}
				trial[r][c] = value
				if found := search(p, trial, []int{r}, []int{c}); found != nil {
					return found
				}
			}
			return nil
		}
	}
	return grid
}

// Solve returns a grid that satisfies every row and column clue of p.
//
// The grid has p.Height rows of p.Width cells each (Filled or Empty). It
// returns nil when no grid fits the clues.
func Solve(p *Puzzle) Grid {
	grid := make(Grid, p.Height)
	rows := make([]int, p.Height)
	for r := range grid {
		grid[r] = make([]int, p.Width)
		for c := range grid[r] {
			grid[r][c] = Unknown
		}
		rows[r] = r
	}
	cols := make([]int, p.Width)
	for c := range cols {
		cols[c] = c
	}
	return search(p, grid, rows, cols)
}
