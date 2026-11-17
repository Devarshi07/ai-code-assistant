// Command main replays a reported game, asks the computer for moves and checks
// the daily puzzles.
package main

import (
	"fmt"
	"os"
	"strings"

	"debuggym/connect-four/connect4"
)

// attempt runs fn, printing a note instead when the feature is not written yet.
func attempt(label string, fn func()) (finished bool) {
	defer func() {
		if r := recover(); r != nil {
			message := fmt.Sprint(r)
			if !strings.HasPrefix(message, "phase 2") {
				panic(r)
			}
			fmt.Printf("%s: %s\n", label, message)
			finished = false
		}
	}()
	fn()
	return true
}

func run() error {
	fmt.Printf("Reported game %s\n", connect4.ReportedGame)
	reported, err := connect4.GameFromMoves(connect4.ReportedGame)
	if err != nil {
		return err
	}
	fmt.Println(connect4.RenderGame(reported))
	fmt.Println()

	board, err := connect4.BoardFromMoves(connect4.Opening)
	if err != nil {
		return err
	}
	fmt.Printf("Opening %s\n", connect4.Opening)
	fmt.Println(connect4.Render(board, nil))
	col, err := connect4.ChooseMove(board, connect4.DefaultDepth)
	if err != nil {
		fmt.Printf("computer: %v\n", err)
	} else {
		fmt.Printf("computer (%s) plays %s\n", board.ToMove().Name(), connect4.DescribeMove(col))
	}
	fmt.Println()

	for _, puzzle := range connect4.DailyPuzzles {
		position := puzzle.Board()
		fmt.Printf("%s puzzle: %s to play and win in %d\n", puzzle.Name, position.ToMove().Name(), puzzle.Plies)
		fmt.Println(connect4.Render(position, nil))
		attempt("solver", func() {
			if win, ok := connect4.Solve(position, puzzle.Plies); ok {
				fmt.Printf("solver: %s wins in %d plies\n", connect4.DescribeMove(win.Move), win.Plies)
			} else {
				fmt.Println("solver: no forced win")
			}
		})
		fmt.Println()
	}

	game := connect4.NewGame(connect4.NewBoard())
	for !game.IsOver() {
		move, err := connect4.ChooseMove(game.Board, 3)
		if err != nil {
			fmt.Printf("computer vs computer: %v\n", err)
			return nil
		}
		if _, err := game.Play(move); err != nil {
			return err
		}
	}
	fmt.Printf("Computer vs computer at depth 3: %s\n", game.Board.ToMoves())
	fmt.Println(connect4.RenderGame(game))
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
