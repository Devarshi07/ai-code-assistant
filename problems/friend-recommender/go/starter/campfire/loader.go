// Loaders for Campfire's nightly data exports.
//
//	members.csv    one row per member: id,name,joined,interests
//	               (joined is YYYY-MM-DD; interests are separated by ';')
//	activity.log   one event per line, applied in order:
//
//	    friend <a> <b>              a and b become friends
//	    unfriend <a> <b>            a ends the friendship with b
//	    block <blocker> <other>     blocker blocks other
//	    unblock <blocker> <other>   blocker lifts the block
//	    deactivate <member>         member closes their account
//
// Blank lines and lines starting with '#' are ignored.

package campfire

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LoadError reports a malformed export. Its message names the file and line.
type LoadError struct {
	Source string // the export, such as "activity.log"
	Line   int    // 1-based line number, or 0 if the problem is not on one line
	Err    error  // what was wrong
}

func (e *LoadError) Error() string {
	if e.Line == 0 {
		return fmt.Sprintf("%s: %v", e.Source, e.Err)
	}
	return fmt.Sprintf("%s line %d: %v", e.Source, e.Line, e.Err)
}

func (e *LoadError) Unwrap() error { return e.Err }

var memberColumns = []string{"id", "name", "joined", "interests"}

// An event is one activity verb: how many member ids it takes and what it
// does to the graph.
type event struct {
	arity int
	apply func(g *SocialGraph, ids []string) error
}

var events = map[string]event{
	"friend": {2, func(g *SocialGraph, ids []string) error {
		_, err := g.AddFriendship(ids[0], ids[1])
		return err
	}},
	"unfriend": {2, func(g *SocialGraph, ids []string) error {
		_, err := g.RemoveFriendship(ids[0], ids[1])
		return err
	}},
	"block":      {2, func(g *SocialGraph, ids []string) error { return g.Block(ids[0], ids[1]) }},
	"unblock":    {2, func(g *SocialGraph, ids []string) error { return g.Unblock(ids[0], ids[1]) }},
	"deactivate": {1, func(g *SocialGraph, ids []string) error { return g.Deactivate(ids[0]) }},
}

// LoadMembersCSV adds every member in a members.csv export to g. source names
// the export in error messages.
func LoadMembersCSV(g *SocialGraph, text, source string) error {
	reader := csv.NewReader(strings.NewReader(text))
	reader.FieldsPerRecord = -1 // a short row leaves its last fields empty
	header, err := reader.Read()
	if err != nil && !errors.Is(err, io.EOF) {
		return &LoadError{Source: source, Err: err}
	}
	column := make(map[string]int)
	for i, name := range header {
		column[strings.TrimSpace(name)] = i
	}
	var missing []string
	for _, name := range memberColumns {
		if _, ok := column[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return &LoadError{Source: source, Err: fmt.Errorf("missing column(s) %s", strings.Join(missing, ", "))}
	}
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return &LoadError{Source: source, Err: err} // a *csv.ParseError names its line
		}
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue // a line of spaces
		}
		line, _ := reader.FieldPos(0)
		field := func(name string) string {
			if i := column[name]; i < len(record) {
				return strings.TrimSpace(record[i])
			}
			return ""
		}
		joined, err := ParseDate(field("joined"))
		if err != nil {
			return &LoadError{Source: source, Line: line, Err: err}
		}
		user, err := NewUser(field("id"), field("name"), joined, ParseInterests(field("interests")))
		if err == nil {
			err = g.AddUser(user)
		}
		if err != nil {
			return &LoadError{Source: source, Line: line, Err: err}
		}
	}
}

// ApplyActivity applies an activity log to g, in order, and returns how many
// events of each verb it applied. source names the log in error messages.
func ApplyActivity(g *SocialGraph, text, source string) (map[string]int, error) {
	applied := make(map[string]int)
	for index, raw := range strings.Split(text, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		words := strings.Fields(line)
		verb, ids := words[0], words[1:]
		number := index + 1
		ev, ok := events[verb]
		if !ok {
			return nil, &LoadError{Source: source, Line: number, Err: fmt.Errorf("unknown event %q", verb)}
		}
		if len(ids) != ev.arity {
			return nil, &LoadError{Source: source, Line: number, Err: fmt.Errorf("%s takes %d member id(s), got %d", verb, ev.arity, len(ids))}
		}
		if err := ev.apply(g, ids); err != nil {
			return nil, &LoadError{Source: source, Line: number, Err: err}
		}
		applied[verb]++
	}
	return applied, nil
}

// LoadNetwork builds a graph from a members export plus an activity log.
func LoadNetwork(membersText, activityText string) (*SocialGraph, error) {
	g := NewSocialGraph()
	if err := LoadMembersCSV(g, membersText, "members.csv"); err != nil {
		return nil, err
	}
	if _, err := ApplyActivity(g, activityText, "activity.log"); err != nil {
		return nil, err
	}
	return g, nil
}

// LoadSample loads the small sample network from dir, the project's data
// folder. main.go passes "data"; the tests, which run in tests/, pass "../data".
func LoadSample(dir string) (*SocialGraph, error) {
	members, err := os.ReadFile(filepath.Join(dir, "members.csv"))
	if err != nil {
		return nil, err
	}
	activity, err := os.ReadFile(filepath.Join(dir, "activity.log"))
	if err != nil {
		return nil, err
	}
	return LoadNetwork(string(members), string(activity))
}
