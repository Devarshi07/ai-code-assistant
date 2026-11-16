// Plain-text views of spell-check results, for the CLI and support logs.
// Like the offsets themselves, columns and underlines count runes.

package spellcheck

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

const underlineMark = '^'

// LineCol returns the 1-based line and column of a character offset in text.
func LineCol(text string, offset int) (line, column int) {
	runes := []rune(text)
	before := runes[:min(offset, len(runes))]
	lastBreak := -1
	line = 1
	for i, r := range before {
		if r == '\n' {
			line++
			lastBreak = i
		}
	}
	return line, offset - lastBreak
}

// Underline returns the text with a row of marks under each misspelled word.
func Underline(text string, misspellings []Misspelling) string {
	var out []string
	lineStart := 0
	for _, line := range strings.Split(text, "\n") {
		lineEnd := lineStart + utf8.RuneCountInString(line)
		marks := []rune(strings.Repeat(" ", lineEnd-lineStart))
		for _, m := range misspellings {
			for i := max(m.Start, lineStart); i < min(m.End, lineEnd); i++ {
				marks[i-lineStart] = underlineMark
			}
		}
		out = append(out, line)
		if row := string(marks); strings.ContainsRune(row, underlineMark) {
			out = append(out, strings.TrimRight(row, " "))
		}
		lineStart = lineEnd + 1
	}
	return strings.Join(out, "\n")
}

// FormatReport returns one row per misspelling: line:column, the word, and
// suggestions. suggest, when not nil, is called with each misspelled word and
// returns the replacements to list.
func FormatReport(text string, misspellings []Misspelling, suggest func(word string) []string) string {
	if len(misspellings) == 0 {
		return "No spelling issues found."
	}
	noun := "issues"
	if len(misspellings) == 1 {
		noun = "issue"
	}
	rows := []string{fmt.Sprintf("%d spelling %s:", len(misspellings), noun)}
	for _, m := range misspellings {
		line, column := LineCol(text, m.Start)
		row := fmt.Sprintf("%-10s", fmt.Sprintf("  %d:%d", line, column)) + m.Word
		if suggest != nil {
			options := suggest(m.Word)
			if len(options) > 0 {
				row = fmt.Sprintf("%-24s-> %s", row, strings.Join(options, ", "))
			} else {
				row = fmt.Sprintf("%-24s(no suggestions)", row)
			}
		}
		rows = append(rows, row)
	}
	return strings.Join(rows, "\n")
}
