package tests

// Independent brute-force checker for forced wins, used by the phase 2 and 3
// tests.
//
// It plays every line out on the Board with its own four-in-a-row test, so it
// does not rely on rules.go or ai.go.

import "debuggym/connect-four/connect4"

var bruteDirections = [][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}}

func completesFour(board *connect4.Board, col int, player connect4.Disc) bool {
	row := board.Height(col)
	for _, direction := range bruteDirections {
		count := 1
		for _, sign := range []int{1, -1} {
			c, r := col+sign*direction[0], row+sign*direction[1]
			for c >= 0 && c < board.Columns && r >= 0 && r < board.Rows && board.Cell(c, r) == player {
				count++
				c += sign * direction[0]
				r += sign * direction[1]
			}
		}
		if count >= 4 {
			return true
		}
	}
	return false
}

func openColumns(board *connect4.Board) []int {
	var columns []int
	for c := 0; c < board.Columns; c++ {
		if board.Height(c) < board.Rows {
			columns = append(columns, c)
		}
	}
	return columns
}

// moveForcesWin reports whether playing col forces a four within plies plies,
// whatever the reply.
func moveForcesWin(board *connect4.Board, col, plies int) bool {
	if completesFour(board, col, board.ToMove()) {
		return true
	}
	if plies < 3 {
		return false
	}
	_, _ = board.Drop(col)
	defer board.Undo()
	replies := openColumns(board)
	if len(replies) == 0 {
		return false
	}
	for _, reply := range replies {
		if completesFour(board, reply, board.ToMove()) {
			return false
		}
	}
	for _, reply := range replies {
		_, _ = board.Drop(reply)
		ok := canForceWin(board, plies-2)
		_, _ = board.Undo()
		if !ok {
			return false
		}
	}
	return true
}

func canForceWin(board *connect4.Board, plies int) bool {
	for _, col := range openColumns(board) {
		if moveForcesWin(board, col, plies) {
			return true
		}
	}
	return false
}
