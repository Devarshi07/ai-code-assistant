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
// It deepens iteratively over odd distances 1, 3, 5, ...: the first distance at
// which a forced win exists is the exact answer. Each step is a yes/no search
// ("can the side to move force a four within n plies?"), which is alpha-beta
// with the narrowest possible window, plus a transposition table, centre-first
// move ordering and forced replies to immediate threats.
func Solve(b *Board, maxPlies int) (ForcedWin, bool) {
	if maxPlies < 1 || len(b.LegalMoves()) == 0 {
		return ForcedWin{}, false
	}
	search := newWinSearch(b.Copy())
	for plies := 1; plies <= maxPlies; plies += 2 {
		if move := search.winningMove(plies); move >= 0 {
			return ForcedWin{Move: move, Plies: plies}, true
		}
	}
	return ForcedWin{}, false
}

// positionKey identifies a position exactly: a packed number for normal-sized
// boards, the grid text for bigger ones.
type positionKey struct {
	packed uint64
	grid   string
}

// winSearch is a yes/no forced-win search for the player to move on a board.
type winSearch struct {
	board   *Board
	order   []int
	packed  bool
	weights [][]uint64
	key     uint64
	proven  map[positionKey]int // key -> smallest n known to force a win
	refuted map[positionKey]int // key -> largest n known not to
}

func newWinSearch(b *Board) *winSearch {
	s := &winSearch{
		board:   b,
		order:   CentreOrder(b.Columns),
		packed:  (b.Rows+1)*b.Columns <= 63,
		proven:  map[positionKey]int{},
		refuted: map[positionKey]int{},
	}
	// Exact position key, updated as discs are dropped. Each column is a number
	// with a leading 1 bit above one bit per disc (1 = yellow), and the columns
	// are packed side by side. Larger boards fall back to the grid text.
	if s.packed {
		s.weights = make([][]uint64, b.Columns)
		for col := 0; col < b.Columns; col++ {
			base := uint64(1) << ((b.Rows + 1) * col)
			s.weights[col] = make([]uint64, b.Rows)
			for row := range s.weights[col] {
				s.weights[col][row] = base << row
			}
			s.key += base
			for row := 0; row < b.Height(col); row++ {
				s.key += s.weight(col, row, b.Cell(col, row))
			}
		}
	}
	return s
}

func (s *winSearch) weight(col, row int, player Disc) uint64 {
	if player == Red {
		return s.weights[col][row]
	}
	return 2 * s.weights[col][row]
}

func (s *winSearch) positionKey() positionKey {
	if s.packed {
		return positionKey{packed: s.key}
	}
	return positionKey{grid: s.board.ToGrid()}
}

// drop plays col for the side to move and returns the weight to hand back to undo.
func (s *winSearch) drop(col int) uint64 {
	player := s.board.ToMove()
	row, _ := s.board.Drop(col)
	var weight uint64
	if s.packed {
		weight = s.weight(col, row, player)
	}
	s.key += weight
	return weight
}

func (s *winSearch) undo(weight uint64) {
	s.board.Undo()
	s.key -= weight
}

// winsWithin reports whether the side to move can force a four within plies plies.
func (s *winSearch) winsWithin(plies int) bool {
	key := s.positionKey()
	if n, ok := s.proven[key]; ok && n <= plies {
		return true
	}
	if n, ok := s.refuted[key]; ok && n >= plies {
		return false
	}
	result := s.winningMove(plies) >= 0
	if result {
		s.proven[key] = plies
	} else {
		s.refuted[key] = plies
	}
	return result
}

// winningMove returns a column that forces a four within plies plies, or -1.
func (s *winSearch) winningMove(plies int) int {
	b := s.board
	me := b.ToMove()
	for _, col := range s.order {
		if IsWinningDrop(b, col, me) {
			return col
		}
	}
	if plies < 3 {
		return -1
	}
	threats := WinningColumns(b, me.Other())
	if len(threats) > 1 {
		return -1 // only one of them can be blocked
	}
	if len(threats) == 1 {
		if s.everyReplyLoses(threats[0], plies) {
			return threats[0]
		}
		return -1
	}
	for _, col := range s.order {
		if b.CanPlay(col) && s.everyReplyLoses(col, plies) {
			return col
		}
	}
	return -1
}

// everyReplyLoses reports whether, after dropping into col, every reply still
// loses within plies - 1.
func (s *winSearch) everyReplyLoses(col, plies int) bool {
	b := s.board
	weight := s.drop(col)
	defer s.undo(weight)
	defender := b.ToMove()
	playable := false
	for _, reply := range s.order {
		if !b.CanPlay(reply) {
			continue
		}
		playable = true
		if IsWinningDrop(b, reply, defender) {
			return false
		}
	}
	if !playable {
		return false // the board filled up: a draw
	}
	threats := WinningColumns(b, defender.Other())
	if len(threats) > 1 {
		return true // two threats: the defender cannot block both
	}
	if len(threats) == 1 {
		return s.replyLoses(threats[0], plies)
	}
	for _, reply := range s.order {
		if b.CanPlay(reply) && !s.replyLoses(reply, plies) {
			return false
		}
	}
	return true
}

func (s *winSearch) replyLoses(reply, plies int) bool {
	weight := s.drop(reply)
	stillWinning := s.winsWithin(plies - 2)
	s.undo(weight)
	return stillWinning
}
