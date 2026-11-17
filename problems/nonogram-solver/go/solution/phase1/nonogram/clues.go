package nonogram

// Clue derivation: turning a designer's drawing into the puzzle players see.

// LineClue run-length encodes one line of a picture.
//
// It returns the lengths of the filled blocks in order, e.g. the line `.##.#..`
// has the clue [2 1]. An all-empty line has the clue [].
func LineClue(cells []int) []int {
	clue := []int{}
	run := 0
	for _, cell := range cells {
		if cell == Filled {
			run++
		} else if run > 0 {
			clue = append(clue, run)
			run = 0
		}
	}
	if run > 0 {
		clue = append(clue, run)
	}
	return clue
}

// CluesFromGrid returns the row clues and the column clues of a complete grid.
func CluesFromGrid(grid Grid) (rowClues, colClues [][]int) {
	for _, row := range grid {
		rowClues = append(rowClues, LineClue(row))
	}
	for _, col := range Columns(grid) {
		colClues = append(colClues, LineClue(col))
	}
	return rowClues, colClues
}

// PuzzleFromPicture builds the puzzle for a drawing given as a grid.
func PuzzleFromPicture(picture Grid, meta Meta) (*Puzzle, error) {
	rowClues, colClues := CluesFromGrid(picture)
	return NewPuzzle(rowClues, colClues, meta)
}

// PuzzleFromPictureText builds the puzzle for a drawing given as picture text.
func PuzzleFromPictureText(picture string, meta Meta) (*Puzzle, error) {
	grid, err := ParseGrid(picture)
	if err != nil {
		return nil, err
	}
	return PuzzleFromPicture(grid, meta)
}
