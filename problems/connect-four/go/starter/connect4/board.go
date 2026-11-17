// Package connect4 is the engine behind a Connect Four app: the board model,
// the rules, game flow, text rendering and the computer player.
//
// The board is stored column by column with row 0 at the bottom, because discs
// fall: each column is a stack. In code, columns are numbered from 0 (leftmost).
// Players see them numbered from 1, and move strings use the players' numbers:
// "4453" means the 4th, 4th, 5th and 3rd columns from the left.
//
// The board knows nothing about winning; see rules.go for that. It will happily
// keep accepting discs after someone has connected four, which is what the
// search code wants when it plays moves out and takes them back.
package connect4

import (
	"fmt"
	"strings"
)

// Disc is the content of a cell: Empty, Red or Yellow.
type Disc byte

const (
	Empty  Disc = '.'
	Red    Disc = 'R' // Red always moves first
	Yellow Disc = 'Y'
)

// Other returns the opponent of d.
func (d Disc) Other() Disc {
	if d == Red {
		return Yellow
	}
	return Red
}

// Name is "Red" or "Yellow".
func (d Disc) Name() string {
	if d == Red {
		return "Red"
	}
	return "Yellow"
}

func (d Disc) String() string { return string(rune(d)) }

// BoardError reports a malformed position or an illegal drop.
type BoardError struct {
	Message string
}

func (e *BoardError) Error() string { return e.Message }

func boardErrorf(format string, args ...any) error {
	return &BoardError{Message: fmt.Sprintf(format, args...)}
}

// Board is a Connect Four position plus the moves that led to it.
type Board struct {
	Columns, Rows int
	cells         [][]Disc
	heights       []int
	history       []int
	discs         int
}

// NewBoard returns an empty standard board: 7 columns and 6 rows.
func NewBoard() *Board {
	board, _ := NewBoardSize(7, 6)
	return board
}

// NewBoardSize returns an empty board of any size that can hold four in a row.
func NewBoardSize(columns, rows int) (*Board, error) {
	if columns < 4 || rows < 4 {
		return nil, boardErrorf("a %dx%d board is too small for four in a row", columns, rows)
	}
	board := &Board{Columns: columns, Rows: rows, heights: make([]int, columns)}
	board.cells = make([][]Disc, columns)
	for col := range board.cells {
		board.cells[col] = make([]Disc, rows)
		for row := range board.cells[col] {
			board.cells[col][row] = Empty
		}
	}
	return board, nil
}

// -- construction and serialisation ---------------------------------------------

// BoardFromMoves replays a move string such as "4453" (1-based columns, Red
// first) on a standard board.
func BoardFromMoves(moves string) (*Board, error) {
	board := NewBoard()
	for index, symbol := range strings.ReplaceAll(moves, " ", "") {
		col := int(symbol - '0')
		if symbol < '0' || symbol > '9' || col < 1 || col > board.Columns {
			return nil, boardErrorf("move %d: '%c' is not a column from 1 to %d", index+1, symbol, board.Columns)
		}
		if _, err := board.Drop(col - 1); err != nil {
			return nil, err
		}
	}
	return board, nil
}

// BoardFromGrid parses a position drawn top row first, as in puzzle files and
// bug reports.
//
// Each non-blank line is one row; spaces and '|' borders are ignored. The side
// to move follows from the disc counts (Red moves first). Loaded boards have no
// history, so Undo stops at the loaded position.
func BoardFromGrid(text string) (*Board, error) {
	var grid []string
	for _, line := range strings.Split(text, "\n") {
		line = strings.ReplaceAll(line, " ", "")
		line = strings.TrimRight(strings.TrimSpace(line), "|")
		line = strings.TrimLeft(line, "|")
		if line != "" {
			grid = append(grid, line)
		}
	}
	if len(grid) == 0 {
		return nil, boardErrorf("grid is empty")
	}
	width := len(grid[0])
	for _, line := range grid {
		if len(line) != width {
			return nil, boardErrorf("every row of the grid must have the same width")
		}
	}
	board, err := NewBoardSize(width, len(grid))
	if err != nil {
		return nil, err
	}
	reds := 0
	for col := 0; col < board.Columns; col++ {
		for row := 0; row < board.Rows; row++ {
			symbol := Disc(grid[board.Rows-1-row][col])
			if symbol != Empty && symbol != Red && symbol != Yellow {
				return nil, boardErrorf("unknown symbol '%c' in the grid", symbol)
			}
			if symbol == Empty {
				continue
			}
			if board.heights[col] != row {
				return nil, boardErrorf("column %d has a floating disc", col+1)
			}
			board.cells[col][row] = symbol
			board.heights[col]++
			board.discs++
			if symbol == Red {
				reds++
			}
		}
	}
	yellows := board.discs - reds
	if reds-yellows != 0 && reds-yellows != 1 {
		return nil, boardErrorf("impossible position: %d red discs and %d yellow", reds, yellows)
	}
	return board, nil
}

// ToMoves returns the moves played on this board object as a 1-based move string.
func (b *Board) ToMoves() string {
	var text strings.Builder
	for _, col := range b.history {
		fmt.Fprintf(&text, "%d", col+1)
	}
	return text.String()
}

// ToGrid returns the position as text, top row first: the format BoardFromGrid reads.
func (b *Board) ToGrid() string {
	lines := make([]string, 0, b.Rows)
	for row := b.Rows - 1; row >= 0; row-- {
		var line strings.Builder
		for col := 0; col < b.Columns; col++ {
			line.WriteByte(byte(b.cells[col][row]))
		}
		lines = append(lines, line.String())
	}
	return strings.Join(lines, "\n")
}

// Copy returns an independent board with the same position and history.
func (b *Board) Copy() *Board {
	clone := &Board{Columns: b.Columns, Rows: b.Rows, discs: b.discs}
	clone.cells = make([][]Disc, b.Columns)
	for col := range b.cells {
		clone.cells[col] = append([]Disc(nil), b.cells[col]...)
	}
	clone.heights = append([]int(nil), b.heights...)
	clone.history = append([]int(nil), b.history...)
	return clone
}

// -- queries ----------------------------------------------------------------------

// ToMove returns the player whose disc goes in next.
func (b *Board) ToMove() Disc {
	if b.discs%2 == 0 {
		return Red
	}
	return Yellow
}

// MoveCount is the number of discs on the board.
func (b *Board) MoveCount() int { return b.discs }

// InBounds reports whether (col, row) is a cell of the board.
func (b *Board) InBounds(col, row int) bool {
	return col >= 0 && col < b.Columns && row >= 0 && row < b.Rows
}

// Cell returns the disc at (col, row).
func (b *Board) Cell(col, row int) Disc { return b.cells[col][row] }

// Height is the number of discs in a column; also the row the next disc lands on.
func (b *Board) Height(col int) int { return b.heights[col] }

// CanPlay reports whether col exists and still has room.
func (b *Board) CanPlay(col int) bool {
	return col >= 0 && col < b.Columns && b.heights[col] < b.Rows
}

// LegalMoves lists the columns that still have room, left to right.
func (b *Board) LegalMoves() []int {
	moves := []int{}
	for col := 0; col < b.Columns; col++ {
		if b.heights[col] < b.Rows {
			moves = append(moves, col)
		}
	}
	return moves
}

// IsFull reports whether every cell holds a disc.
func (b *Board) IsFull() bool { return b.discs == b.Columns*b.Rows }

// -- changes ----------------------------------------------------------------------

// Drop puts the side to move's disc into col and returns the row it lands on.
func (b *Board) Drop(col int) (int, error) {
	if col < 0 || col >= b.Columns {
		return 0, boardErrorf("there is no column %d", col)
	}
	row := b.heights[col]
	if row >= b.Rows {
		return 0, boardErrorf("column %d is full", col+1)
	}
	b.cells[col][row] = b.ToMove()
	b.heights[col] = row + 1
	b.discs++
	b.history = append(b.history, col)
	return row, nil
}

// Undo takes back the most recent drop and returns its column.
func (b *Board) Undo() (int, error) {
	if len(b.history) == 0 {
		return 0, boardErrorf("there is no move to undo")
	}
	col := b.history[len(b.history)-1]
	b.history = b.history[:len(b.history)-1]
	b.heights[col]--
	b.cells[col][b.heights[col]] = Empty
	b.discs--
	return col, nil
}

func (b *Board) String() string {
	return fmt.Sprintf("Board(%dx%d, %d discs, %s to move)", b.Columns, b.Rows, b.discs, b.ToMove())
}
