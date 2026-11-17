package nonogram

// Reading and writing .non puzzle files.
//
// Contributors send puzzles as small text files:
//
//	# Pack 3, puzzle 7
//	title: Sailboat
//	author: R. Okafor
//	rows: 1 | 2 | 3 | 1 1
//	cols: 2 | 0 | 3 1
//
// Each field is `key: value` on its own line. `rows` and `cols` list one clue
// per line, separated by `|`; the numbers inside a clue are separated by
// spaces (commas are accepted too). `0` marks a line with no filled cells.
// Lines starting with `#` are comments.

import (
	"os"
	"slices"
	"strconv"
	"strings"
)

var fieldNames = []string{"title", "author", "rows", "cols"}

func parseClueList(value, field string) ([][]int, error) {
	parts := strings.Split(value, "|")
	clues := make([][]int, len(parts))
	for i, part := range parts {
		tokens := strings.Fields(strings.ReplaceAll(part, ",", " "))
		if len(tokens) == 0 {
			return nil, puzzleErrorf("%s: clue %d is blank (write 0 for an empty line)", field, i+1)
		}
		numbers := make([]int, len(tokens))
		for t, token := range tokens {
			n, err := strconv.Atoi(token)
			if err != nil || n < 0 || token[0] == '+' {
				return nil, puzzleErrorf("%s: clue %d ('%s') is not a list of numbers", field, i+1, strings.TrimSpace(part))
			}
			numbers[t] = n
		}
		switch {
		case len(numbers) == 1 && numbers[0] == 0:
			clues[i] = []int{}
		case slices.Contains(numbers, 0):
			return nil, puzzleErrorf("%s: clue %d mixes 0 with other blocks", field, i+1)
		default:
			clues[i] = numbers
		}
	}
	return clues, nil
}

// ParsePuzzle parses the contents of a .non file into a Puzzle.
func ParsePuzzle(text string) (*Puzzle, error) {
	fields := map[string]string{}
	for i, raw := range strings.Split(text, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		colon := strings.Index(line, ":")
		key := line
		if colon >= 0 {
			key = line[:colon]
		}
		key = strings.ToLower(strings.TrimSpace(key))
		if colon < 0 || !slices.Contains(fieldNames, key) {
			return nil, puzzleErrorf("line %d: expected one of %s followed by ':'", i+1, strings.Join(fieldNames, ", "))
		}
		if _, seen := fields[key]; seen {
			return nil, puzzleErrorf("line %d: %s is given twice", i+1, key)
		}
		fields[key] = strings.TrimSpace(line[colon+1:])
	}
	for _, required := range []string{"rows", "cols"} {
		if _, ok := fields[required]; !ok {
			return nil, puzzleErrorf("puzzle file has no %s field", required)
		}
	}
	rowClues, err := parseClueList(fields["rows"], "rows")
	if err != nil {
		return nil, err
	}
	colClues, err := parseClueList(fields["cols"], "cols")
	if err != nil {
		return nil, err
	}
	return NewPuzzle(rowClues, colClues, Meta{Title: fields["title"], Author: fields["author"]})
}

// FormatPuzzle serializes a Puzzle in the .non format (it round-trips through ParsePuzzle).
func FormatPuzzle(p *Puzzle) string {
	lines := []string{"title: " + p.Title}
	if p.Author != "" {
		lines = append(lines, "author: "+p.Author)
	}
	formatList := func(clues [][]int) string {
		parts := make([]string, len(clues))
		for i, clue := range clues {
			parts[i] = FormatClue(clue)
		}
		return strings.Join(parts, " | ")
	}
	lines = append(lines, "rows: "+formatList(p.RowClues), "cols: "+formatList(p.ColClues))
	return strings.Join(lines, "\n") + "\n"
}

// LoadPuzzle reads and parses a .non file.
func LoadPuzzle(path string) (*Puzzle, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParsePuzzle(string(data))
}
