package connect4

import "fmt"

// Draw is the status of a full board with no four.
const Draw = "Draw"

// NoWinner is the Winner of a game nobody has won (yet).
const NoWinner Disc = 0

// GameError reports a move the game does not allow, such as playing after a win.
type GameError struct {
	Message string
}

func (e *GameError) Error() string { return e.Message }

// Game is one game of Connect Four: a board plus the result so far.
type Game struct {
	Board        *Board
	Winner       Disc // NoWinner until somebody connects four
	WinningCells []Cell
}

// NewGame starts a game on board, which may already hold a finished position.
func NewGame(board *Board) *Game {
	game := &Game{Board: board, Winner: NoWinner}
	if found := FindWinner(board); found != nil {
		game.Winner = found.Player
		game.WinningCells = found.Cells
	}
	return game
}

// GameFromMoves replays a stored move log, e.g. "4453". It fails if a move is illegal.
func GameFromMoves(moves string) (*Game, error) {
	game := NewGame(NewBoard())
	index := 0
	for _, symbol := range moves {
		if symbol == ' ' {
			continue
		}
		index++
		if symbol < '0' || symbol > '9' {
			return nil, &GameError{fmt.Sprintf("move %d: '%c' is not a column number", index, symbol)}
		}
		if _, err := game.Play(int(symbol-'0') - 1); err != nil {
			return nil, &GameError{fmt.Sprintf("move %d (column %c): %s", index, symbol, err)}
		}
	}
	return game, nil
}

// GameFromGrid loads a saved position, e.g. from a puzzle file or a bug report.
func GameFromGrid(text string) (*Game, error) {
	board, err := BoardFromGrid(text)
	if err != nil {
		return nil, err
	}
	return NewGame(board), nil
}

// IsOver reports whether somebody has won or the board is full.
func (g *Game) IsOver() bool {
	return g.Winner != NoWinner || g.Board.IsFull()
}

// ToMove returns the player to move, or NoWinner (zero) once the game is over.
func (g *Game) ToMove() Disc {
	if g.IsOver() {
		return NoWinner
	}
	return g.Board.ToMove()
}

// Status is "Red wins", "Draw" or "Yellow to move".
func (g *Game) Status() string {
	if g.Winner != NoWinner {
		return g.Winner.Name() + " wins"
	}
	if g.Board.IsFull() {
		return Draw
	}
	return g.Board.ToMove().Name() + " to move"
}

// LegalMoves lists the playable columns, none once the game is over.
func (g *Game) LegalMoves() []int {
	if g.IsOver() {
		return []int{}
	}
	return g.Board.LegalMoves()
}

// Play drops the current player's disc into col (0-based) and returns the row.
func (g *Game) Play(col int) (int, error) {
	if g.IsOver() {
		return 0, &GameError{"the game is over: " + g.Status()}
	}
	player := g.Board.ToMove()
	row, err := g.Board.Drop(col)
	if err != nil {
		return 0, err
	}
	if cells := WinningLine(g.Board, col, row); cells != nil {
		g.Winner = player
		g.WinningCells = cells
	}
	return row, nil
}

// Undo takes back the last move, reopening the game if it had just been won.
func (g *Game) Undo() (int, error) {
	col, err := g.Board.Undo()
	if err != nil {
		return 0, err
	}
	g.Winner = NoWinner
	g.WinningCells = nil
	return col, nil
}

func (g *Game) String() string {
	return fmt.Sprintf("Game('%s', %s)", g.Board.ToMoves(), g.Status())
}
