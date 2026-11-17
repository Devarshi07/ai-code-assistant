package tests

import (
	"errors"
	"reflect"
	"sort"
	"testing"

	"debuggym/connect-four/connect4"
)

// The helpers in this file are shared by every test file in the package.

// Move logs (1-based columns, Red first). Each one ends on the winning disc.
const (
	horizontal    = "1122334"
	vertical      = "1212121"
	rising        = "12234334744" // Red: columns 1-4, climbing to the right
	falling       = "76654554144" // Red: column 4 row 4 down to column 7 row 1
	fallingMiddle = "76654414455" // same line, but the last disc lands in the middle of it
	reported      = "453421332272" // support ticket: Yellow, column 2 down to column 5
)

// A saved position from the tournament archive (Red to move by disc count).
const saved = `
.......
.......
.Y.....
.YY....
.RRY...
YRRRY.R
`

// A complete game that fills the board without anyone connecting four.
const drawn = "444777176463166564635121577135541253322232"

// assertEqual stops the test when got and want differ.
func assertEqual(t *testing.T, got, want any, what string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

func mustBoard(t *testing.T, moves string) *connect4.Board {
	t.Helper()
	board, err := connect4.BoardFromMoves(moves)
	if err != nil {
		t.Fatalf("BoardFromMoves(%q): %v", moves, err)
	}
	return board
}

func mustGame(t *testing.T, moves string) *connect4.Game {
	t.Helper()
	game, err := connect4.GameFromMoves(moves)
	if err != nil {
		t.Fatalf("GameFromMoves(%q): %v", moves, err)
	}
	return game
}

func cells(colsAndRows ...int) []connect4.Cell {
	var out []connect4.Cell
	for i := 0; i < len(colsAndRows); i += 2 {
		out = append(out, connect4.Cell{Col: colsAndRows[i], Row: colsAndRows[i+1]})
	}
	return out
}

func sortCells(in []connect4.Cell) []connect4.Cell {
	out := append([]connect4.Cell(nil), in...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].Col != out[j].Col {
			return out[i].Col < out[j].Col
		}
		return out[i].Row < out[j].Row
	})
	return out
}

func assertWon(t *testing.T, game *connect4.Game, winner connect4.Disc, want []connect4.Cell) {
	t.Helper()
	if game.Winner != winner {
		t.Fatalf("%s: expected %s to have won", game.Status(), winner.Name())
	}
	if !game.IsOver() {
		t.Fatal("a won game should be over")
	}
	assertEqual(t, sortCells(game.WinningCells), sortCells(want), "winning cells")
}

func TestPhase1Board(t *testing.T) {
	t.Run("discs stack from the bottom", func(t *testing.T) {
		board := mustBoard(t, "4453")
		assertEqual(t, board.Cell(3, 0), connect4.Red, "cell (3, 0)")
		assertEqual(t, board.Cell(3, 1), connect4.Yellow, "cell (3, 1)")
		assertEqual(t, board.Cell(4, 0), connect4.Red, "cell (4, 0)")
		assertEqual(t, board.Cell(2, 0), connect4.Yellow, "cell (2, 0)")
		assertEqual(t, board.Height(3), 2, "height of column 4")
		assertEqual(t, board.ToMove(), connect4.Red, "side to move")
	})

	t.Run("full column rejects a seventh disc", func(t *testing.T) {
		board := mustBoard(t, "444444")
		assertEqual(t, board.CanPlay(3), false, "CanPlay(3)")
		for _, col := range board.LegalMoves() {
			if col == 3 {
				t.Fatal("column 4 is full but listed as a legal move")
			}
		}
		_, err := board.Drop(3)
		var boardErr *connect4.BoardError
		if !errors.As(err, &boardErr) {
			t.Fatalf("Drop(3): got error %v, want a *BoardError", err)
		}
	})

	t.Run("undo restores the position and the turn", func(t *testing.T) {
		board := mustBoard(t, "4453")
		before := board.ToGrid()
		if _, err := board.Drop(0); err != nil {
			t.Fatal(err)
		}
		assertEqual(t, board.ToMove(), connect4.Yellow, "side to move after a drop")
		col, err := board.Undo()
		if err != nil {
			t.Fatal(err)
		}
		assertEqual(t, col, 0, "undone column")
		assertEqual(t, board.ToGrid(), before, "grid after undo")
		assertEqual(t, board.ToMove(), connect4.Red, "side to move after undo")
		assertEqual(t, board.ToMoves(), "4453", "move string after undo")
	})

	t.Run("grid round trip keeps the side to move", func(t *testing.T) {
		board := mustBoard(t, "44536")
		loaded, err := connect4.BoardFromGrid(board.ToGrid())
		if err != nil {
			t.Fatal(err)
		}
		assertEqual(t, loaded.ToGrid(), board.ToGrid(), "grid")
		assertEqual(t, loaded.ToMove(), connect4.Yellow, "side to move")
		assertEqual(t, loaded.LegalMoves(), []int{0, 1, 2, 3, 4, 5, 6}, "legal moves")
	})

	t.Run("grid with a floating disc is rejected", func(t *testing.T) {
		_, err := connect4.BoardFromGrid("....\n....\n.R..\n.Y..\n....\n....")
		var boardErr *connect4.BoardError
		if !errors.As(err, &boardErr) {
			t.Fatalf("BoardFromGrid: got error %v, want a *BoardError", err)
		}
	})
}

func TestPhase1Game(t *testing.T) {
	t.Run("horizontal four wins", func(t *testing.T) {
		assertWon(t, mustGame(t, horizontal), connect4.Red, cells(0, 0, 1, 0, 2, 0, 3, 0))
	})

	t.Run("vertical four wins", func(t *testing.T) {
		assertWon(t, mustGame(t, vertical), connect4.Red, cells(0, 0, 0, 1, 0, 2, 0, 3))
	})

	t.Run("rising diagonal wins", func(t *testing.T) {
		assertWon(t, mustGame(t, rising), connect4.Red, cells(0, 0, 1, 1, 2, 2, 3, 3))
	})

	t.Run("falling diagonal wins", func(t *testing.T) {
		assertWon(t, mustGame(t, falling), connect4.Red, cells(3, 3, 4, 2, 5, 1, 6, 0))
	})

	t.Run("falling diagonal completed in the middle", func(t *testing.T) {
		assertWon(t, mustGame(t, fallingMiddle), connect4.Red, cells(3, 3, 4, 2, 5, 1, 6, 0))
	})

	t.Run("reported game ends with yellow's diagonal", func(t *testing.T) {
		game := mustGame(t, reported)
		assertWon(t, game, connect4.Yellow, cells(1, 3, 2, 2, 3, 1, 4, 0))
		assertEqual(t, game.Status(), "Yellow wins", "status")
	})

	t.Run("saved position shows the winner", func(t *testing.T) {
		game, err := connect4.GameFromGrid(saved)
		if err != nil {
			t.Fatal(err)
		}
		if game.Winner != connect4.Yellow {
			t.Fatalf("loaded position says %q, want Yellow to have won", game.Status())
		}
		assertEqual(t, game.LegalMoves(), []int{}, "legal moves")
	})

	t.Run("no moves after the game is won", func(t *testing.T) {
		game := mustGame(t, horizontal)
		_, err := game.Play(4)
		var gameErr *connect4.GameError
		if !errors.As(err, &gameErr) {
			t.Fatalf("Play(4): got error %v, want a *GameError", err)
		}
	})

	t.Run("undo reopens a won game", func(t *testing.T) {
		game := mustGame(t, vertical)
		if _, err := game.Undo(); err != nil {
			t.Fatal(err)
		}
		assertEqual(t, game.Winner, connect4.NoWinner, "winner")
		assertEqual(t, game.ToMove(), connect4.Red, "side to move")
	})

	t.Run("full board without four is a draw", func(t *testing.T) {
		game := mustGame(t, drawn)
		assertEqual(t, game.Winner, connect4.NoWinner, "winner")
		assertEqual(t, game.IsOver(), true, "IsOver")
		assertEqual(t, game.Status(), "Draw", "status")
	})
}

func TestPhase1Threats(t *testing.T) {
	t.Run("hint spots a diagonal threat", func(t *testing.T) {
		// Yellow needs column 2 to finish the diagonal from the ticket.
		board := mustBoard(t, reported[:len(reported)-2])
		assertEqual(t, board.ToMove(), connect4.Red, "side to move")
		assertEqual(t, connect4.WinningColumns(board, connect4.Yellow), []int{1}, "Yellow's winning columns")
		assertEqual(t, connect4.WinningColumns(board, connect4.Red), []int{}, "Red's winning columns")
	})
}
