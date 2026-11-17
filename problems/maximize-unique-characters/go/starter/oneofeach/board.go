package oneofeach

// Text previews of a board for the puzzle desk and the CLI.

import (
	"fmt"
	"strings"
)

// AlphabetStrip draws an 'AB.D..' style strip: upper-case letters are on the board, dots are unused.
func AlphabetStrip(mask uint32) string {
	strip := make([]byte, len(Alphabet))
	for i := range strip {
		if mask&(1<<i) != 0 {
			strip[i] = Alphabet[i] - 'a' + 'A'
		} else {
			strip[i] = '.'
		}
	}
	return string(strip)
}

// Render returns the header, word row and alphabet strip for one puzzle.
func Render(puzzle Puzzle) string {
	var words []string
	for _, word := range puzzle.Words {
		words = append(words, strings.ToUpper(word.Text))
	}
	row := strings.Join(words, "  ")
	if row == "" {
		row = "(empty board)"
	}
	return strings.Join([]string{
		fmt.Sprintf("%s  %s: %d tiles", puzzle.Day, puzzle.Theme, puzzle.TileCount()),
		"  " + row,
		fmt.Sprintf("  [%s]  %d letters unused", AlphabetStrip(puzzle.Covered()), len(puzzle.UnusedLetters())),
	}, "\n")
}
