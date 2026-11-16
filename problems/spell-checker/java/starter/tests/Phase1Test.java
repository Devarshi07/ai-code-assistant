package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import spellcheck.Dictionary;
import spellcheck.Misspelling;
import spellcheck.Report;
import spellcheck.Report.Position;
import spellcheck.SpellChecker;
import spellcheck.Token;
import spellcheck.Tokenizer;

class Phase1Test {
    static final Dictionary WORDS = Dictionary.load();

    static Token token(String text, int start, int end) {
        return new Token(text, start, end);
    }

    static Misspelling misspelling(String word, int start, int end) {
        return new Misspelling(word, start, end);
    }

    static List<Misspelling> issues(String text) {
        return new SpellChecker(WORDS).check(text);
    }

    // Tokenizer

    @Test
    void wordsAndOffsets() {
        assertEquals(List.of(token("Hello", 0, 5), token("world", 7, 12)), Tokenizer.tokenize("Hello, world!"));
    }

    @Test
    void hyphenatedWordsAreSplit() {
        assertEquals(List.of(token("A", 0, 1), token("well", 2, 6), token("known", 7, 12),
                        token("half", 14, 18), token("baked", 19, 24), token("idea", 25, 29)),
                Tokenizer.tokenize("A well-known, half-baked idea"));
    }

    @Test
    void numbersAreSkipped() {
        assertEquals(List.of(token("Room", 0, 4), token("at", 9, 11), token("on", 17, 19), token("the", 20, 23)),
                Tokenizer.tokenize("Room 204 at 10am on the 3rd"));
    }

    @Test
    void apostrophesInsideWords() {
        assertEquals(List.of(token("I", 0, 1), token("don't", 2, 7), token("think", 8, 13),
                        token("it's", 14, 18), token("o'clock", 21, 28)),
                Tokenizer.tokenize("I don't think it's 5 o'clock"));
    }

    @Test
    void quotesAroundWordsAreNotPartOfThem() {
        assertEquals(List.of(token("Draft", 1, 6), token("notes", 8, 13), token("the", 15, 18),
                        token("students", 19, 27), token("work", 29, 33)),
                Tokenizer.tokenize("'Draft' notes, the students' work"));
    }

    @Test
    void smartQuotesAroundWords() {
        assertEquals(List.of(token("She", 0, 3), token("wrote", 4, 9), token("mispelled", 11, 20), token("twice", 22, 27)),
                Tokenizer.tokenize("She wrote ‘mispelled’ twice"));
    }

    @Test
    void contractionsTypedOnMobileStayWhole() {
        assertEquals(List.of(token("We", 0, 2), token("don’t", 3, 8), token("ship", 9, 13),
                        token("until", 14, 19), token("it’s", 20, 24), token("ready", 25, 30)),
                Tokenizer.tokenize("We don’t ship until it’s ready"));
    }

    // SpellChecker

    @Test
    void misspellingsAreReportedWithOffsets() {
        assertEquals(List.of(misspelling("recieve", 2, 9), misspelling("emials", 19, 25)),
                issues("I recieve too many emials."));
    }

    @Test
    void caseDoesNotMatter() {
        assertEquals(List.of(misspelling("mets", 18, 22)), issues("Tomorrow the team mets. Monday works."));
        SpellChecker checker = new SpellChecker(WORDS, false);
        assertEquals(List.of(), checker.check("TOMORROW Works"));
    }

    @Test
    void acronymsAreSkipped() {
        assertEquals(List.of(), issues("Ask NASA about the API"));
        SpellChecker checker = new SpellChecker(WORDS, false);
        assertEquals(List.of("NASA", "API"),
                checker.check("Ask NASA about the API").stream().map(Misspelling::word).toList());
    }

    @Test
    void contractionsAndPossessives() {
        assertEquals(List.of(), issues("I don't know if the team's draft is done, but it's close."));
    }

    @Test
    void ignoreAllAcceptsTheWord() {
        SpellChecker checker = new SpellChecker(WORDS);
        assertEquals(List.of(misspelling("Deploy", 0, 6), misspelling("Kubernetes", 7, 17)),
                checker.check("Deploy Kubernetes today"));
        checker.ignore("kubernetes");
        checker.ignore("DEPLOY");
        assertEquals(List.of(), checker.check("Deploy Kubernetes today"));
    }

    @Test
    void contractionsTypedOnMobile() {
        assertEquals(List.of(), issues("I don’t know if it’s done, and we can’t wait."));
    }

    @Test
    void possessivesTypedOnMobile() {
        assertEquals(List.of(), issues("The team’s notes are in the project’s folder."));
    }

    @Test
    void misspellingsNextToMobileContractions() {
        assertEquals(List.of(misspelling("Ths", 0, 3), misspelling("rihgt", 10, 15)),
                issues("Ths isn’t rihgt, they’re late"));
    }

    // Report

    static final String TEXT = "Standup notes\nShipped the calender view.\nTeh end";
    static final List<Misspelling> FOUND = List.of(misspelling("calender", 26, 34), misspelling("Teh", 41, 44));

    @Test
    void lineAndColumn() {
        assertEquals(new Position(1, 1), Report.lineCol(TEXT, 0));
        assertEquals(new Position(2, 13), Report.lineCol(TEXT, 26));
        assertEquals(new Position(3, 1), Report.lineCol(TEXT, 41));
    }

    @Test
    void underlineMarksEachWord() {
        assertEquals(String.join("\n",
                "Standup notes",
                "Shipped the calender view.",
                "            ^^^^^^^^",
                "Teh end",
                "^^^"), Report.underline(TEXT, FOUND));
    }

    @Test
    void reportRows() {
        assertEquals("2 spelling issues:\n  2:13    calender\n  3:1     Teh", Report.formatReport(TEXT, FOUND));
        assertEquals("No spelling issues found.", Report.formatReport(TEXT, List.of()));
    }

    @Test
    void reportWithSuggestions() {
        Map<String, List<String>> options = Map.of("calender", List.of("calendar"), "Teh", List.of());
        assertEquals(String.join("\n",
                "2 spelling issues:",
                "  2:13    calender      -> calendar",
                "  3:1     Teh           (no suggestions)"), Report.formatReport(TEXT, FOUND, options::get));
    }
}
