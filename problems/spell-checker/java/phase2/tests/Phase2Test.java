package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static spellcheck.Suggester.editDistance;

import java.util.List;

import org.junit.jupiter.api.Test;

import spellcheck.Dictionary;
import spellcheck.Misspelling;
import spellcheck.SpellChecker;
import spellcheck.Suggester;

class Phase2Test {
    static final Dictionary WORDS = Dictionary.load();

    // Every word here except "damper" is one or two edits away from "lamp".
    static final Dictionary RANKING = Dictionary.parse("""
            lamp 40
            lamb 40
            limp 90
            lump 10
            lam 5
            clamp 40
            camp 300
            ramp 40
            lisp 70
            clasp 500
            lumps 999
            damper 1000
            """);

    // editDistance

    @Test
    void identicalAndEmpty() {
        assertEquals(0, editDistance("note", "note"));
        assertEquals(0, editDistance("", ""));
        assertEquals(3, editDistance("", "abc"));
        assertEquals(3, editDistance("abc", ""));
    }

    @Test
    void singleEdits() {
        assertEquals(1, editDistance("note", "notes"), "insertion");
        assertEquals(1, editDistance("notes", "note"), "deletion");
        assertEquals(1, editDistance("note", "nose"), "substitution");
        assertEquals(1, editDistance("calender", "calendar"));
        assertEquals(1, editDistance("tomorow", "tomorrow"));
    }

    @Test
    void swappedLettersCostTwo() {
        assertEquals(2, editDistance("teh", "the"));
        assertEquals(2, editDistance("recieve", "receive"));
        assertEquals(2, editDistance("ab", "ba"));
    }

    @Test
    void longerDistances() {
        assertEquals(2, editDistance("flaw", "lawn"));
        assertEquals(2, editDistance("receipt", "recipe"));
        assertEquals(6, editDistance("spelling", "misspelled"));
        assertEquals(6, editDistance("notebook", "bookmark"));
    }

    @Test
    void apostrophesAndAccentsAreCharacters() {
        assertEquals(1, editDistance("dont", "don't"));
        assertEquals(1, editDistance("cafe", "café"));
    }

    // Ranking

    @Test
    void closestFirstThenMostFrequentThenAlphabetical() {
        assertEquals(List.of("lamp", "camp", "limp", "clamp", "lamb", "ramp", "lump", "lam", "lumps", "clasp", "lisp"),
                new Suggester(RANKING).suggest("lamp", 20));
    }

    @Test
    void misspelledWord() {
        assertEquals(List.of("limp", "lamp", "lump", "lumps", "camp", "lisp", "clamp", "lamb", "ramp", "lam"),
                new Suggester(RANKING).suggest("lmp", 20));
    }

    @Test
    void limit() {
        Suggester suggester = new Suggester(RANKING);
        assertEquals(List.of("limp", "lamp", "lump", "lumps"), suggester.suggest("lmp", 4));
        assertEquals(List.of("limp", "lamp", "lump", "lumps", "camp"), suggester.suggest("lmp"), "the default limit is 5");
    }

    @Test
    void inputIsNormalized() {
        assertEquals(List.of("lamp", "camp", "limp"), new Suggester(RANKING).suggest("LAMP", 3));
    }

    @Test
    void nothingCloseEnough() {
        assertEquals(List.of(), new Suggester(RANKING).suggest("xyzzy"));
        assertEquals(List.of(), new Suggester(WORDS).suggest("xylophone"));
    }

    // Suggestions from the base dictionary

    final Suggester suggester = new Suggester(WORDS);

    @Test
    void distanceBeatsFrequency() {
        assertEquals(List.of("relieve", "receive", "believe"), suggester.suggest("recieve"));
    }

    @Test
    void commonTypos() {
        assertEquals(List.of("tomorrow"), suggester.suggest("tomorow"));
        assertEquals(List.of("haven't", "have"), suggester.suggest("havent"));
        assertEquals(List.of("friend", "fiend", "find", "fried"), suggester.suggest("freind"));
        assertEquals(List.of("occurred", "occur"), suggester.suggest("occured"));
    }

    @Test
    void shortWords() {
        assertEquals(List.of("tea", "tech", "ten", "the", "be"), suggester.suggest("teh"));
        assertEquals(List.of("car", "card", "care", "cart"), suggester.suggest("carr", 4));
    }

    @Test
    void frequencyTiesAreAlphabetical() {
        assertEquals(List.of("were", "word", "weird", "wired", "fiend"), suggester.suggest("wierd"));
    }

    @Test
    void apostrophesAndAccents() {
        assertEquals(List.of("don't", "done", "dot"), suggester.suggest("dont", 3));
        assertEquals(List.of("came", "café", "care"), suggester.suggest("cafe", 3));
        assertEquals(List.of("don't", "won't", "can't", "doesn't"), suggester.suggest("don’t", 4));
    }

    // SpellChecker suggestions

    @Test
    void suggestionsFollowTheWritersCapitalisation() {
        SpellChecker checker = new SpellChecker(WORDS);
        assertEquals(List.of("Relieve", "Receive", "Believe"), checker.suggest("Recieve"));
        assertEquals(List.of("TEA", "TECH", "TEN"), checker.suggest("TEH", 3));
        assertEquals(List.of("The", "This", "They", "Her", "There", "Their"), checker.suggest("Thier", 6));
    }

    @Test
    void misspellingsWithSuggestions() {
        SpellChecker checker = new SpellChecker(WORDS);
        List<Misspelling> found = checker.check("Teh calender is ready");
        assertEquals(List.of("Teh", "calender"), found.stream().map(Misspelling::word).toList());
        assertEquals(List.of(List.of("Tea", "Tech"), List.of("calendar")),
                found.stream().map(m -> checker.suggest(m.word(), 2)).toList());
    }
}
