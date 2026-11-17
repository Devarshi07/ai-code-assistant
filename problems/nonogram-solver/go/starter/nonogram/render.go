package nonogram

// ASCII previews of puzzles, used by the CLI and in review e-mails.
//
// Column clues are stacked above the board and row clues sit to its left:
//
//	          1
//	        2 4 1 4 2
//	    1 1 . # . # .
//	      5 # # # # #

import (
	"fmt"
	"strings"
)

// Render draws the board with clues. With a nil grid every cell shows as '?'.
func Render(p *Puzzle, grid Grid) string {
	rowLabels := make([]string, len(p.RowClues))
	margin := 0
	for i, clue := range p.RowClues {
		rowLabels[i] = FormatClue(clue)
		margin = max(margin, len(rowLabels[i]))
	}
	stacks := make([][]string, len(p.ColClues))
	depth, widest := 0, 0
	for c, clue := range p.ColClues {
		if len(clue) == 0 {
			stacks[c] = []string{"0"}
		}
		for _, n := range clue {
			stacks[c] = append(stacks[c], fmt.Sprint(n))
		}
		for _, entry := range stacks[c] {
			widest = max(widest, len(entry))
		}
		depth = max(depth, len(stacks[c]))
	}
	cellWidth := max(2, 1+widest)

	var lines []string
	for level := range depth {
		var line strings.Builder
		line.WriteString(strings.Repeat(" ", margin))
		for _, stack := range stacks {
			offset := depth - len(stack)
			if level >= offset {
				fmt.Fprintf(&line, "%*s", cellWidth, stack[level-offset])
			} else {
				line.WriteString(strings.Repeat(" ", cellWidth))
			}
		}
		lines = append(lines, line.String())
	}
	for r, label := range rowLabels {
		var line strings.Builder
		fmt.Fprintf(&line, "%*s", margin, label)
		for c := range p.Width {
			ch := "?"
			if grid != nil {
				ch = CellChar(grid[r][c])
			}
			fmt.Fprintf(&line, "%*s", cellWidth, ch)
		}
		lines = append(lines, line.String())
	}
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " ")
	}
	return strings.Join(lines, "\n")
}
