// Text views of the store, used by the CLI and the editors' stats panel.
package wordstore

import (
	"fmt"
	"strings"
)

const (
	barWidth = 30
	alphabet = "abcdefghijklmnopqrstuvwxyz"
)

// LetterCount is how many words start with a letter.
type LetterCount struct {
	Letter string
	Total  int
}

// LetterBreakdown lists a row for every first letter in use.
func LetterBreakdown(c *WordContainer) []LetterCount {
	var rows []LetterCount
	for _, letter := range alphabet {
		total, _ := c.Count(string(letter))
		if total > 0 {
			rows = append(rows, LetterCount{string(letter), total})
		}
	}
	return rows
}

func plural(n int, word string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, word)
	}
	return fmt.Sprintf("%d %ss", n, word)
}

// FormatStoreReport is the headline total plus an A-Z bar chart.
func FormatStoreReport(c *WordContainer, title string) string {
	rows := LetterBreakdown(c)
	widest := 1
	sum := 0
	for _, row := range rows {
		widest = max(widest, row.Total)
		sum += row.Total
	}
	lines := []string{fmt.Sprintf("%s: %s", title, plural(c.Size(), "word"))}
	for _, row := range rows {
		bar := strings.Repeat("#", max(1, (barWidth*row.Total+widest/2)/widest))
		lines = append(lines, fmt.Sprintf("  %s  %-*s %4d", row.Letter, barWidth, bar, row.Total))
	}
	lines = append(lines, fmt.Sprintf("  A-Z total: %d", sum))
	return strings.Join(lines, "\n")
}

// FormatPrefix is one autocomplete line: the badge count and the first few completions.
func FormatPrefix(c *WordContainer, prefix string, shown int) string {
	total, err := c.Count(prefix)
	if err != nil {
		return fmt.Sprintf("%s...  %v", prefix, err)
	}
	words, _ := c.WithPrefix(prefix)
	if len(words) > shown {
		words = words[:shown]
	}
	more := ""
	if total > len(words) {
		more = fmt.Sprintf(" (+%d more)", total-len(words))
	}
	listed := "-"
	if len(words) > 0 {
		listed = strings.Join(words, ", ")
	}
	return fmt.Sprintf("%s...  %s: %s%s", prefix, plural(total, "word"), listed, more)
}

// FormatMatches is one pattern-search line, noting when the list was cut at limit.
func FormatMatches(pattern string, words []string, limit int) string {
	if len(words) == 0 {
		return pattern + "  no matches"
	}
	cut := ""
	if limit != NoLimit && len(words) == limit {
		cut = " ..."
	}
	return pattern + "  " + strings.Join(words, ", ") + cut
}
