package connect4

import (
	"fmt"
	"strconv"
	"strings"
)

// Plain-text rendering for the CLI, server logs and bug reports.

// Render draws the board as text, top row first, with the players' column
// numbers below.
//
// Discs whose cell is in highlight, such as a winning line, are drawn in
// lowercase so they stand out in a terminal.
func Render(b *Board, highlight []Cell) string {
	marked := map[Cell]bool{}
	for _, cell := range highlight {
		marked[cell] = true
	}
	var lines []string
	for row := b.Rows - 1; row >= 0; row-- {
		cells := make([]string, b.Columns)
		for col := 0; col < b.Columns; col++ {
			disc := b.Cell(col, row).String()
			if marked[Cell{col, row}] {
				disc = strings.ToLower(disc)
			}
			cells[col] = disc
		}
		lines = append(lines, "| "+strings.Join(cells, " ")+" |")
	}
	lines = append(lines, "+"+strings.Repeat("-", 2*b.Columns+1)+"+")
	numbers := make([]string, b.Columns)
	for col := range numbers {
		numbers[col] = strconv.Itoa(col + 1)
	}
	lines = append(lines, "  "+strings.Join(numbers, " "))
	return strings.Join(lines, "\n")
}

// RenderGame draws the board with any winning line highlighted, followed by the status.
func RenderGame(g *Game) string {
	return Render(g.Board, g.WinningCells) + "\n" + g.Status()
}

// DescribeMove names a column as players say it: DescribeMove(3) is "column 4".
func DescribeMove(col int) string {
	return fmt.Sprintf("column %d", col+1)
}
