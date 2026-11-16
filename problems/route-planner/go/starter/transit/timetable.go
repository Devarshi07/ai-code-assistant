package transit

import (
	"fmt"
	"strconv"
	"strings"
)

// OneWayFlag after a line's name marks a line that only runs in timetable order.
const OneWayFlag = "oneway"

// TimetableError is a malformed timetable entry, reported with its line number.
type TimetableError struct {
	LineNumber int
	Message    string
}

func (e *TimetableError) Error() string {
	return fmt.Sprintf("line %d: %s", e.LineNumber, e.Message)
}

func errorAt(lineNumber int, format string, args ...any) *TimetableError {
	return &TimetableError{LineNumber: lineNumber, Message: fmt.Sprintf(format, args...)}
}

// LoadNetwork builds a Network from the plain-text timetable format used by
// the scheduling team:
//
//	# Harbour City weekday service
//	line Red: Airport 4 Central 3 Harbor 6 Museum
//	line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse
//
// Each entry lists the stations of one line, separated by the running time in
// minutes to the next stop. Station names may contain spaces but must not be
// plain numbers. Lines run both ways unless the name is followed by "oneway".
// Everything after a "#" is a comment. A malformed entry returns a
// *TimetableError.
func LoadNetwork(text, name string) (*Network, error) {
	network := NewNetwork(name)
	for index, raw := range strings.Split(text, "\n") {
		content, _, _ := strings.Cut(raw, "#")
		content = strings.TrimSpace(content)
		if content == "" {
			continue
		}
		line, err := ParseEntry(content, index+1)
		if err != nil {
			return nil, err
		}
		if _, exists := network.Line(line.Name); exists {
			return nil, errorAt(index+1, "duplicate line %q", line.Name)
		}
		if err := network.AddLine(line); err != nil {
			return nil, err
		}
	}
	return network, nil
}

// ParseEntry parses one "line <name> [oneway]: <stops>" entry into a Line.
func ParseEntry(text string, lineNumber int) (*Line, error) {
	header, body, found := strings.Cut(text, ":")
	words := strings.Fields(header)
	if !found || len(words) == 0 || words[0] != "line" {
		return nil, errorAt(lineNumber, "expected 'line <name>: <stations>'")
	}
	words = words[1:]
	oneWay := len(words) > 0 && words[len(words)-1] == OneWayFlag
	if oneWay {
		words = words[:len(words)-1]
	}
	if len(words) == 0 {
		return nil, errorAt(lineNumber, "the line has no name")
	}
	stations, minutes, err := parseStops(body, lineNumber)
	if err != nil {
		return nil, err
	}
	return NewLine(strings.Join(words, " "), stations, minutes, oneWay)
}

func parseStops(body string, lineNumber int) ([]string, []int, error) {
	var stations, name []string
	var minutes []int
	for _, token := range strings.Fields(body) {
		if !isNumber(token) {
			name = append(name, token)
			continue
		}
		if len(name) == 0 {
			return nil, nil, errorAt(lineNumber, "running time %s must follow a station name", token)
		}
		value, err := strconv.Atoi(token)
		if err != nil {
			return nil, nil, errorAt(lineNumber, "running time %s is out of range", token)
		}
		if value < 1 {
			return nil, nil, errorAt(lineNumber, "running times must be at least 1 minute")
		}
		stations = append(stations, strings.Join(name, " "))
		minutes = append(minutes, value)
		name = nil
	}
	if len(name) == 0 {
		return nil, nil, errorAt(lineNumber, "a line must end with a station name")
	}
	stations = append(stations, strings.Join(name, " "))
	if len(stations) < 2 {
		return nil, nil, errorAt(lineNumber, "a line needs at least two stations")
	}
	return stations, minutes, nil
}

// isNumber reports whether token is a plain number such as "12".
func isNumber(token string) bool {
	for _, r := range token {
		if r < '0' || r > '9' {
			return false
		}
	}
	return token != ""
}
