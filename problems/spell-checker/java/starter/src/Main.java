import java.util.List;

import spellcheck.Dictionary;
import spellcheck.Misspelling;
import spellcheck.Report;
import spellcheck.SpellChecker;

/** Spell-checks a few sample notes and prints what the editor would show. */
public class Main {
    private record Note(String name, String text) {
    }

    private static final List<Note> NOTES = List.of(
            new Note("standup.txt", """
                    Standup, Tuesday
                    Shipped the new calender view. We'll fix the seperate login bugs tomorow.
                    Don't forget: the team's retro moved to 3pm."""),
            new Note("groceries.txt", """
                    Groceries - milk, eggs, bread, cheese and 2 bananas
                    Pick up the reciept for the dinner party"""),
            new Note("trip.txt", """
                    Flight on the 14th. Hotel is definately booked,
                    but I havent got the passport back yet. Teh tickets are in my email."""));

    public static void main(String[] args) {
        SpellChecker checker = new SpellChecker(Dictionary.load());
        System.out.println("Dictionary: " + checker.dictionary().size() + " words\n");
        for (Note note : NOTES) {
            List<Misspelling> issues = checker.check(note.text());
            System.out.println("== " + note.name());
            System.out.println(Report.underline(note.text(), issues));
            System.out.println();
            try {
                System.out.println(Report.formatReport(note.text(), issues, checker::suggest));
            } catch (UnsupportedOperationException e) {
                System.out.println(Report.formatReport(note.text(), issues));
                System.out.println("  (suggestions unavailable: " + e.getMessage() + ")");
            }
            System.out.println();
        }
    }
}
