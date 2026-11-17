// Reading word lists into a WordContainer.
//
// Lists are UTF-8 text with one entry per line:
//
//	# comment lines start with '#'; blank lines are skipped
//	apple
//	Ice cream        stored as "icecream"
//	jalapeño;60      "entry;score" lines from crossword lists; the score is ignored
//
// A bad entry is recorded in the LoadReport instead of returning an error, so
// one stray line does not abort an import. The bundled lists live in data/:
// core.txt holds everyday words and the themed packs (sports.txt, kitchen.txt)
// overlap it.
package wordstore

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Bundled names the lists in data/, in import order.
var Bundled = []string{"core", "sports", "kitchen"}

// Rejection is one entry that could not be stored.
type Rejection struct {
	Line   int
	Entry  string
	Reason string
}

// LoadReport says what happened while importing one list.
type LoadReport struct {
	Source     string
	Added      int
	Duplicates int
	Rejected   []Rejection
}

// Summary is the one-line import log entry.
func (r *LoadReport) Summary() string {
	text := fmt.Sprintf("%s: %d added, %d already stored", r.Source, r.Added, r.Duplicates)
	if len(r.Rejected) > 0 {
		text += fmt.Sprintf(", %d rejected", len(r.Rejected))
	}
	return text
}

// entry is one line of a list that holds an entry.
type entry struct {
	line int
	text string
}

func entries(text string) []entry {
	// Lists exported from spreadsheets often start with a byte-order mark.
	lines := strings.Split(strings.TrimLeft(text, "\uFEFF"), "\n")
	var found []entry
	for i, line := range lines {
		before, _, _ := strings.Cut(line, ";")
		before = strings.TrimSpace(before)
		if before != "" && !strings.HasPrefix(before, "#") {
			found = append(found, entry{i + 1, before})
		}
	}
	return found
}

// LoadText adds every entry in text to c and reports what happened.
func LoadText(c *WordContainer, text, source string) *LoadReport {
	report := &LoadReport{Source: source}
	for _, e := range entries(text) {
		isNew, err := c.Add(e.text)
		var invalid *InvalidWord
		if errors.As(err, &invalid) {
			report.Rejected = append(report.Rejected, Rejection{e.line, e.text, invalid.Message})
			continue
		}
		if isNew {
			report.Added++
		} else {
			report.Duplicates++
		}
	}
	return report
}

// LoadFile imports one list file.
func LoadFile(c *WordContainer, file string) (*LoadReport, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	return LoadText(c, string(data), filepath.Base(file)), nil
}

// LoadBundled imports the bundled lists from dir in order and returns one
// LoadReport per list.
func LoadBundled(c *WordContainer, dir string) ([]*LoadReport, error) {
	var reports []*LoadReport
	for _, name := range Bundled {
		report, err := LoadFile(c, filepath.Join(dir, name+".txt"))
		if err != nil {
			return reports, err
		}
		reports = append(reports, report)
	}
	return reports, nil
}
