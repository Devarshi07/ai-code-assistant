// Command main publishes the designers' drawings, then builds answer keys for contributor puzzles.
package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"debuggym/nonogram-solver/nonogram"
)

const samples = "samples"

var (
	drawings    = []string{"heart.pic", "mug.pic", "lighthouse.pic"}
	contributed = []string{"sailboat.non", "starfield.non"}
)

func publishDrawings() error {
	fmt.Println("== Publishing drawings ==")
	for _, name := range drawings {
		base := strings.TrimSuffix(name, ".pic")
		title := strings.ToUpper(base[:1]) + base[1:]
		text, err := os.ReadFile(filepath.Join(samples, name))
		if err != nil {
			return err
		}
		picture, err := nonogram.ParseGrid(string(text))
		if err != nil {
			return err
		}
		puzzle, err := nonogram.PuzzleFromPicture(picture, nonogram.Meta{Title: title})
		if err != nil {
			var puzzleErr *nonogram.PuzzleError
			if !errors.As(err, &puzzleErr) {
				return err
			}
			fmt.Printf("%s: cannot publish: %s\n\n", name, err)
			continue
		}
		status := "drawing does not match its own clues"
		if nonogram.IsSolution(puzzle, picture) {
			status = "ok"
		}
		fmt.Printf("%s: %dx%d, %d filled cells, self-check %s\n", name, puzzle.Width, puzzle.Height, puzzle.FilledCells(), status)
		fmt.Println(nonogram.Render(puzzle, nil))
		fmt.Println()
	}
	return nil
}

func buildAnswerKeys() error {
	fmt.Println("== Answer keys for contributed puzzles ==")
	for _, name := range contributed {
		puzzle, err := nonogram.LoadPuzzle(filepath.Join(samples, name))
		if err != nil {
			return err
		}
		started := time.Now()
		grid := nonogram.Solve(puzzle)
		elapsed := float64(time.Since(started).Microseconds()) / 1000
		if grid == nil {
			fmt.Printf("%s: no grid fits these clues\n\n", puzzle.Title)
			continue
		}
		verdict := "FAILED verification"
		if nonogram.IsSolution(puzzle, grid) {
			verdict = "verified"
		}
		fmt.Printf("%s by %s: solved in %.1f ms, %s\n", puzzle.Title, puzzle.Author, elapsed, verdict)
		fmt.Println(nonogram.Render(puzzle, grid))
		fmt.Println()
	}
	return nil
}

func main() {
	if err := publishDrawings(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	if err := buildAnswerKeys(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
