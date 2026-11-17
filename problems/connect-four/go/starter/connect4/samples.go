package connect4

// Sample games and puzzles used by the demo and by the support team.

// ReportedGame is the move log attached to support ticket #4127. The player
// says Yellow's last disc completed a diagonal running from column 2 down to
// column 5.
const ReportedGame = "453421332272"

// Opening is a short opening for the computer-opponent demo.
const Opening = "4453"

// Puzzle is a daily puzzle: Moves is how the position arose (1-based) and
// Plies the advertised forced-win distance.
type Puzzle struct {
	Name  string
	Moves string
	Plies int
}

// Board builds the puzzle position.
func (p Puzzle) Board() *Board {
	board, err := BoardFromMoves(p.Moves)
	if err != nil {
		panic(err)
	}
	return board
}

// DailyPuzzles are the puzzles shown in the app this week.
var DailyPuzzles = []Puzzle{
	{"Monday", "216646", 3},
	{"Wednesday", "36566312253", 5},
	{"Friday", "164773774571", 7},
}
