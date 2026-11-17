package connect4

import "sort"

// Win detection.
//
// A player wins by connecting four or more of their discs in a straight line:
// across, up and down, or along either diagonal. Lines are found by walking
// outwards from a single disc, which is all the game needs after each drop.

// Cell is a board cell: Col is 0-based from the left, row 0 is the bottom.
type Cell struct {
	Col, Row int
}

// Winner is a four found on a loaded position: who has it and where.
type Winner struct {
	Player Disc
	Cells  []Cell
}

// Axes lists every line a disc can belong to, as a {column step, row step}
// pair. runLength walks each axis in both directions from the disc.
var Axes = [][2]int{
	{1, 0},   // horizontal
	{0, 1},   // vertical
	{1, 1},   // diagonal
	{1, -1},  // other diagonal
}

// runLength counts the discs of player in an unbroken line through (col, row)
// along axis.
//
// The cell (col, row) itself is counted as player's whether or not a disc is
// there yet, so this also answers "what if player dropped here?".
func runLength(b *Board, col, row int, axis [2]int, player Disc) int {
	length := 1
	for _, sign := range []int{1, -1} {
		c, r := col+sign*axis[0], row+sign*axis[1]
		for b.InBounds(c, r) && b.Cell(c, r) == player {
			length++
			c += sign * axis[0]
			r += sign * axis[1]
		}
	}
	return length
}

// lineCells returns the cells of the unbroken line counted by runLength,
// sorted by column then row.
func lineCells(b *Board, col, row int, axis [2]int, player Disc) []Cell {
	cells := []Cell{{col, row}}
	for _, sign := range []int{1, -1} {
		c, r := col+sign*axis[0], row+sign*axis[1]
		for b.InBounds(c, r) && b.Cell(c, r) == player {
			cells = append(cells, Cell{c, r})
			c += sign * axis[0]
			r += sign * axis[1]
		}
	}
	sort.Slice(cells, func(i, j int) bool {
		if cells[i].Col != cells[j].Col {
			return cells[i].Col < cells[j].Col
		}
		return cells[i].Row < cells[j].Row
	})
	return cells
}

// WinningLine returns the cells of a four-or-longer line through the disc at
// (col, row), or nil when there is none.
func WinningLine(b *Board, col, row int) []Cell {
	player := b.Cell(col, row)
	if player == Empty {
		return nil
	}
	for _, axis := range Axes {
		if runLength(b, col, row, axis, player) >= 4 {
			return lineCells(b, col, row, axis, player)
		}
	}
	return nil
}

// IsWinningDrop reports whether dropping player's disc into col would connect
// four. The board is not changed.
func IsWinningDrop(b *Board, col int, player Disc) bool {
	if !b.CanPlay(col) {
		return false
	}
	row := b.Height(col)
	for _, axis := range Axes {
		if runLength(b, col, row, axis, player) >= 4 {
			return true
		}
	}
	return false
}

// WinningColumns lists the columns where player would connect four right now.
func WinningColumns(b *Board, player Disc) []int {
	columns := []int{}
	for col := 0; col < b.Columns; col++ {
		if IsWinningDrop(b, col, player) {
			columns = append(columns, col)
		}
	}
	return columns
}

// FindWinner scans a whole position for a four and returns nil when there is
// none. Used when a position is loaded from a grid and has no move history.
func FindWinner(b *Board) *Winner {
	for col := 0; col < b.Columns; col++ {
		for row := 0; row < b.Height(col); row++ {
			if cells := WinningLine(b, col, row); cells != nil {
				return &Winner{Player: b.Cell(col, row), Cells: cells}
			}
		}
	}
	return nil
}
