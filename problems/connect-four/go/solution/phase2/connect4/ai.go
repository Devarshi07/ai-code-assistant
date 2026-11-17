package connect4

import (
	"errors"
	"math"
	"sort"
	"sync"
)

// The computer opponent and the puzzle checker.
//
// ChooseMove powers "Play the computer". Solve checks the daily puzzles ("Red
// to play and win in 5"): it finds how quickly the side to move can force a
// win. Distances are counted in plies. A ply is one disc dropped by either
// player, so a win in 5 plies means three discs from the winner and two from
// the defender, the last of the three completing the four.

const (
	// DefaultDepth is how many plies ChooseMove looks ahead by default.
	DefaultDepth = 4
	// WinScore is far above anything Evaluate can return.
	WinScore = 1_000_000
)

// Heuristic points for a window of four cells that holds discs of one player
// only, indexed by how many of that player's discs it holds.
var windowPoints = [5]int{0, 0, 2, 5, 0}

const centrePoints = 3

// ForcedWin is a forced win found by Solve. Move is the 0-based column to play
// now; Plies counts both sides' discs until the four is completed, so 1 means
// the move wins at once.
type ForcedWin struct {
	Move  int
	Plies int
}

// CentreOrder lists the columns from the centre outwards, left before right:
// 7 columns give [3 2 4 1 5 0 6].
func CentreOrder(columns int) []int {
	middle := float64(columns-1) / 2
	order := make([]int, columns)
	for col := range order {
		order[col] = col
	}
	distance := func(col int) float64 { return math.Abs(float64(col) - middle) }
	sort.SliceStable(order, func(i, j int) bool {
		di, dj := distance(order[i]), distance(order[j])
		if di != dj {
			return di < dj
		}
		return order[i] < order[j]
	})
	return order
}

var (
	windowMu    sync.Mutex
	windowCache = map[[2]int][][4]Cell{}
)

// Windows returns every straight line of four cells on a board of this size.
func Windows(columns, rows int) [][4]Cell {
	windowMu.Lock()
	defer windowMu.Unlock()
	key := [2]int{columns, rows}
	if found, ok := windowCache[key]; ok {
		return found
	}
	var found [][4]Cell
	for _, axis := range Axes {
		for col := 0; col < columns; col++ {
			for row := 0; row < rows; row++ {
				endCol, endRow := col+3*axis[0], row+3*axis[1]
				if endCol >= 0 && endCol < columns && endRow >= 0 && endRow < rows {
					var window [4]Cell
					for i := range window {
						window[i] = Cell{col + i*axis[0], row + i*axis[1]}
					}
					found = append(found, window)
				}
			}
		}
	}
	windowCache[key] = found
	return found
}

// Evaluate is the static score of a position from player's point of view.
// Positive is good.
//
// It rewards windows of four that only player could still complete, penalises
// the opponent's in the same way, and prefers discs in the centre column.
// Symmetric by construction: Evaluate(b, p) == -Evaluate(b, p.Other()).
// Only meaningful for positions that do not already contain a four.
func Evaluate(b *Board, player Disc) int {
	opponent := player.Other()
	score := 0
	for _, window := range Windows(b.Columns, b.Rows) {
		mine, theirs := 0, 0
		for _, cell := range window {
			switch b.Cell(cell.Col, cell.Row) {
			case player:
				mine++
			case opponent:
				theirs++
			}
		}
		if theirs == 0 {
			score += windowPoints[mine]
		} else if mine == 0 {
			score -= windowPoints[theirs]
		}
	}
	if b.Columns%2 == 1 {
		centre := b.Columns / 2
		for row := 0; row < b.Height(centre); row++ {
			if b.Cell(centre, row) == player {
				score += centrePoints
			} else {
				score -= centrePoints
			}
		}
	}
	return score
}

// orderedMoves lists the playable columns, centre first.
func orderedMoves(b *Board) []int {
	moves := make([]int, 0, b.Columns)
	for _, col := range CentreOrder(b.Columns) {
		if b.CanPlay(col) {
			moves = append(moves, col)
		}
	}
	return moves
}

// ChooseMove picks a 0-based column for the side to move.
//
// It wins at once if it can, otherwise blocks a column where the opponent
// would win next turn, otherwise looks depth plies ahead with minimax and
// scores the positions it reaches with Evaluate. It returns an error when the
// board is full.
func ChooseMove(b *Board, depth int) (int, error) {
	moves := orderedMoves(b)
	if len(moves) == 0 {
		return 0, errors.New("no legal moves: the board is full")
	}
	me := b.ToMove()
	for _, col := range moves {
		if IsWinningDrop(b, col, me) {
			return col, nil
		}
	}
	for _, col := range moves {
		if IsWinningDrop(b, col, me.Other()) {
			return col, nil
		}
	}
	bestCol, bestScore := moves[0], math.MinInt
	for _, col := range moves {
		b.Drop(col)
		score := -minimax(b, depth-1)
		b.Undo()
		if score > bestScore {
			bestCol, bestScore = col, score
		}
	}
	return bestCol, nil
}

// minimax is negamax: the score for the side to move, looking depth plies ahead.
func minimax(b *Board, depth int) int {
	me := b.ToMove()
	if depth <= 0 {
		return Evaluate(b, me)
	}
	moves := orderedMoves(b)
	if len(moves) == 0 {
		return 0
	}
	for _, col := range moves {
		if IsWinningDrop(b, col, me) {
			return WinScore + depth // a sooner win leaves more depth
		}
	}
	best := math.MinInt
	for _, col := range moves {
		b.Drop(col)
		score := -minimax(b, depth-1)
		b.Undo()
		best = max(best, score)
	}
	return best
}

// Solve finds the fastest forced win for the side to move within maxPlies
// plies. The second result is false when there is none.
//
// It is plain minimax over every line of play up to maxPlies deep. A win
// completed on ply n (counted from this position) scores WinScore - n, so the
// best score also tells how far away the fastest forced win is.
func Solve(b *Board, maxPlies int) (ForcedWin, bool) {
	if maxPlies < 1 {
		return ForcedWin{}, false
	}
	moves := orderedMoves(b)
	for _, col := range moves {
		if IsWinningDrop(b, col, b.ToMove()) {
			return ForcedWin{Move: col, Plies: 1}, true
		}
	}
	bestCol, bestScore := -1, 0
	for _, col := range moves {
		b.Drop(col)
		score := -outcome(b, maxPlies-1, 1)
		b.Undo()
		if score > bestScore {
			bestCol, bestScore = col, score
		}
	}
	if bestCol < 0 {
		return ForcedWin{}, false
	}
	return ForcedWin{Move: bestCol, Plies: WinScore - bestScore}, true
}

// outcome is the exact minimax score for the side to move, ply plies below the
// root: WinScore - n if the side to move forces a four on root ply n, the
// negation if the opponent does, and 0 if neither happens within depth more plies.
func outcome(b *Board, depth, ply int) int {
	if depth <= 0 {
		return 0
	}
	moves := orderedMoves(b)
	if len(moves) == 0 {
		return 0
	}
	for _, col := range moves {
		if IsWinningDrop(b, col, b.ToMove()) {
			return WinScore - (ply + 1)
		}
	}
	best := math.MinInt
	for _, col := range moves {
		b.Drop(col)
		score := -outcome(b, depth-1, ply+1)
		b.Undo()
		best = max(best, score)
	}
	return best
}
