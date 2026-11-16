package tests

import (
	"slices"
	"strings"
	"testing"

	"debuggym/spell-checker/spellcheck"
)

// The test files in this folder share one package, so the helpers here are
// used by the later phases' tests too.

// span is a token or misspelling as (text, start, end).
type span struct {
	text       string
	start, end int
}

// baseWords loads the base dictionary that ships with the package.
func baseWords(t *testing.T) *spellcheck.Dictionary {
	t.Helper()
	words, err := spellcheck.LoadDefault()
	if err != nil {
		t.Fatalf("loading the base dictionary: %v", err)
	}
	return words
}

func tokenSpans(text string) []span {
	var spans []span
	for _, token := range spellcheck.Tokenize(text) {
		spans = append(spans, span{token.Text, token.Start, token.End})
	}
	return spans
}

func misspellingSpans(found []spellcheck.Misspelling) []span {
	var spans []span
	for _, m := range found {
		spans = append(spans, span{m.Word, m.Start, m.End})
	}
	return spans
}

// issues checks text with a default checker over the base dictionary.
func issues(t *testing.T, text string) []span {
	t.Helper()
	return misspellingSpans(spellcheck.NewSpellChecker(baseWords(t)).Check(text))
}

func expectTokens(t *testing.T, text string, want []span) {
	t.Helper()
	if got := tokenSpans(text); !slices.Equal(got, want) {
		t.Errorf("Tokenize(%q)\n got %v\nwant %v", text, got, want)
	}
}

func expectIssues(t *testing.T, text string, want []span) {
	t.Helper()
	if got := issues(t, text); !slices.Equal(got, want) {
		t.Errorf("Check(%q)\n got %v\nwant %v", text, got, want)
	}
}

// Tokenizer

func TestPhase1WordsAndOffsets(t *testing.T) {
	expectTokens(t, "Hello, world!", []span{{"Hello", 0, 5}, {"world", 7, 12}})
}

func TestPhase1HyphenatedWordsAreSplit(t *testing.T) {
	expectTokens(t, "A well-known, half-baked idea", []span{
		{"A", 0, 1}, {"well", 2, 6}, {"known", 7, 12}, {"half", 14, 18}, {"baked", 19, 24}, {"idea", 25, 29},
	})
}

func TestPhase1NumbersAreSkipped(t *testing.T) {
	expectTokens(t, "Room 204 at 10am on the 3rd", []span{
		{"Room", 0, 4}, {"at", 9, 11}, {"on", 17, 19}, {"the", 20, 23},
	})
}

func TestPhase1ApostrophesInsideWords(t *testing.T) {
	expectTokens(t, "I don't think it's 5 o'clock", []span{
		{"I", 0, 1}, {"don't", 2, 7}, {"think", 8, 13}, {"it's", 14, 18}, {"o'clock", 21, 28},
	})
}

func TestPhase1QuotesAroundWordsAreNotPartOfThem(t *testing.T) {
	expectTokens(t, "'Draft' notes, the students' work", []span{
		{"Draft", 1, 6}, {"notes", 8, 13}, {"the", 15, 18}, {"students", 19, 27}, {"work", 29, 33},
	})
}

func TestPhase1SmartQuotesAroundWords(t *testing.T) {
	expectTokens(t, "She wrote ‘mispelled’ twice", []span{
		{"She", 0, 3}, {"wrote", 4, 9}, {"mispelled", 11, 20}, {"twice", 22, 27},
	})
}

func TestPhase1ContractionsTypedOnMobileStayWhole(t *testing.T) {
	expectTokens(t, "We don’t ship until it’s ready", []span{
		{"We", 0, 2}, {"don’t", 3, 8}, {"ship", 9, 13}, {"until", 14, 19}, {"it’s", 20, 24}, {"ready", 25, 30},
	})
}

// SpellChecker

func TestPhase1MisspellingsAreReportedWithOffsets(t *testing.T) {
	expectIssues(t, "I recieve too many emials.", []span{{"recieve", 2, 9}, {"emials", 19, 25}})
}

func TestPhase1CaseDoesNotMatter(t *testing.T) {
	expectIssues(t, "Tomorrow the team mets. Monday works.", []span{{"mets", 18, 22}})
	checker := spellcheck.NewSpellChecker(baseWords(t))
	checker.IgnoreUppercase = false
	if got := checker.Check("TOMORROW Works"); len(got) != 0 {
		t.Errorf("Check(%q) with IgnoreUppercase off = %v, want none", "TOMORROW Works", got)
	}
}

func TestPhase1AcronymsAreSkipped(t *testing.T) {
	expectIssues(t, "Ask NASA about the API", nil)
	checker := spellcheck.NewSpellChecker(baseWords(t))
	checker.IgnoreUppercase = false
	var words []string
	for _, m := range checker.Check("Ask NASA about the API") {
		words = append(words, m.Word)
	}
	if want := []string{"NASA", "API"}; !slices.Equal(words, want) {
		t.Errorf("with IgnoreUppercase off, got %q, want %q", words, want)
	}
}

func TestPhase1ContractionsAndPossessives(t *testing.T) {
	expectIssues(t, "I don't know if the team's draft is done, but it's close.", nil)
}

func TestPhase1IgnoreAllAcceptsAWord(t *testing.T) {
	checker := spellcheck.NewSpellChecker(baseWords(t))
	want := []spellcheck.Misspelling{{Word: "Deploy", Start: 0, End: 6}, {Word: "Kubernetes", Start: 7, End: 17}}
	if got := checker.Check("Deploy Kubernetes today"); !slices.Equal(got, want) {
		t.Fatalf("before Ignore: got %v, want %v", got, want)
	}
	checker.Ignore("kubernetes")
	checker.Ignore("DEPLOY")
	if got := checker.Check("Deploy Kubernetes today"); len(got) != 0 {
		t.Errorf("after Ignore: got %v, want none", got)
	}
}

func TestPhase1ContractionsTypedOnMobile(t *testing.T) {
	expectIssues(t, "I don’t know if it’s done, and we can’t wait.", nil)
}

func TestPhase1PossessivesTypedOnMobile(t *testing.T) {
	expectIssues(t, "The team’s notes are in the project’s folder.", nil)
}

func TestPhase1MisspellingsNextToMobileContractions(t *testing.T) {
	expectIssues(t, "Ths isn’t rihgt, they’re late", []span{{"Ths", 0, 3}, {"rihgt", 10, 15}})
}

// Report

const reportText = "Standup notes\nShipped the calender view.\nTeh end"

var reportFound = []spellcheck.Misspelling{{Word: "calender", Start: 26, End: 34}, {Word: "Teh", Start: 41, End: 44}}

func TestPhase1LineAndColumn(t *testing.T) {
	for _, c := range []struct{ offset, line, column int }{{0, 1, 1}, {26, 2, 13}, {41, 3, 1}} {
		if line, column := spellcheck.LineCol(reportText, c.offset); line != c.line || column != c.column {
			t.Errorf("LineCol(text, %d) = %d, %d; want %d, %d", c.offset, line, column, c.line, c.column)
		}
	}
}

func TestPhase1UnderlineMarksEachWord(t *testing.T) {
	want := strings.Join([]string{
		"Standup notes",
		"Shipped the calender view.",
		"            ^^^^^^^^",
		"Teh end",
		"^^^",
	}, "\n")
	if got := spellcheck.Underline(reportText, reportFound); got != want {
		t.Errorf("Underline:\n%s\nwant:\n%s", got, want)
	}
}

func TestPhase1ReportRows(t *testing.T) {
	want := "2 spelling issues:\n  2:13    calender\n  3:1     Teh"
	if got := spellcheck.FormatReport(reportText, reportFound, nil); got != want {
		t.Errorf("FormatReport:\n%s\nwant:\n%s", got, want)
	}
	if got := spellcheck.FormatReport(reportText, nil, nil); got != "No spelling issues found." {
		t.Errorf("FormatReport with no misspellings = %q", got)
	}
}

func TestPhase1ReportWithSuggestions(t *testing.T) {
	options := map[string][]string{"calender": {"calendar"}, "Teh": {}}
	want := strings.Join([]string{
		"2 spelling issues:",
		"  2:13    calender      -> calendar",
		"  3:1     Teh           (no suggestions)",
	}, "\n")
	suggest := func(word string) []string { return options[word] }
	if got := spellcheck.FormatReport(reportText, reportFound, suggest); got != want {
		t.Errorf("FormatReport:\n%s\nwant:\n%s", got, want)
	}
}
