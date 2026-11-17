import java.util.List;
import oneofeach.Board;
import oneofeach.Puzzle;
import oneofeach.Selection;
import oneofeach.Solver;
import oneofeach.Validator;
import oneofeach.Word;
import oneofeach.WordList;

/** Puzzle desk preview: checks this week's hand-picked boards and suggests the best board per theme. */
public class Main {
    record Pick(String day, String theme, List<String> words) {}

    // Boards the designers picked by hand for this week.
    private static final List<Pick> SCHEDULE = List.of(
            new Pick("2026-10-12", "kitchen", List.of("butter", "fig", "jam", "wok")),
            new Pick("2026-10-13", "music", List.of("drum", "harp", "tempo", "sax")),
            new Pick("2026-10-14", "animals", List.of("zebra", "lynx", "dog")),
            new Pick("2026-10-15", "garden", List.of("tulip", "fern", "moss")));

    public static void main(String[] args) {
        List<Word> words = WordList.load();
        System.out.println("Loaded " + words.size() + " candidates in " + WordList.themes(words).size()
                + " themes, " + Solver.playableWords(words).size() + " playable spellings\n");

        System.out.println("== Hand-picked boards");
        for (Pick pick : SCHEDULE) {
            Puzzle puzzle = new Puzzle(pick.day(), pick.theme(), pick.words());
            System.out.println(Board.render(puzzle));
            List<String> problems = Validator.selectionProblems(puzzle.words());
            System.out.println("  status: " + (problems.isEmpty() ? "ok" : "REJECTED: " + String.join("; ", problems)));
            System.out.println();
        }

        System.out.println("== Suggested boards (difficulty 2 or easier)");
        for (String theme : WordList.themes(words)) {
            List<Word> candidates = WordList.filter(words, theme, 2);
            Selection best;
            try {
                best = Solver.bestSelection(candidates);
            } catch (UnsupportedOperationException error) {
                System.out.println("  solver unavailable: " + error.getMessage());
                break;
            }
            System.out.println(Board.render(new Puzzle("next week", theme, best.words())));
            System.out.println("  covers " + best.total() + " letters from " + candidates.size() + " candidates\n");
        }
    }
}
