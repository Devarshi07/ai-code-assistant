import java.util.List;
import wordstore.LoadReport;
import wordstore.Loader;
import wordstore.Report;
import wordstore.WordContainer;

/** Demo: import the bundled lists, then show the stats panel, autocomplete and pattern search. */
public class Main {
    private static final List<String> AUTOCOMPLETE = List.of("bowl", "squ", "ten");
    private static final List<String> RETIRED = List.of("squash", "tennis"); // flagged by the editors as overused

    record Search(String pattern, Integer limit) {}

    private static final List<Search> SEARCHES = List.of(
            new Search("c?t", null), new Search("?a?e", 8), new Search("b??l", null),
            new Search("*ing", null), new Search("*ball", null), new Search("c*e", 6));

    public static void main(String[] args) {
        WordContainer words = new WordContainer();
        System.out.println("Import");
        for (LoadReport report : Loader.loadBundled(words)) {
            System.out.println("  " + report.summary());
            for (LoadReport.Rejection rejected : report.rejected) {
                System.out.println("    line " + rejected.line() + ": " + rejected.reason());
            }
        }
        System.out.println();
        System.out.println(Report.formatStoreReport(words));
        System.out.println();

        System.out.println("Autocomplete");
        for (String prefix : AUTOCOMPLETE) System.out.println("  " + Report.formatPrefix(words, prefix));
        for (String word : RETIRED) words.remove(word);
        System.out.println("  retired " + String.join(", ", RETIRED) + "; " + words.size() + " words left");
        for (String prefix : AUTOCOMPLETE) System.out.println("  " + Report.formatPrefix(words, prefix));
        System.out.println();

        System.out.println("Pattern search");
        for (Search search : SEARCHES) {
            List<String> found;
            try {
                found = words.match(search.pattern(), search.limit());
            } catch (IllegalArgumentException | wordstore.PatternException error) {
                System.out.println("  " + search.pattern() + "  " + error.getMessage());
                break;
            }
            System.out.println("  " + Report.formatMatches(search.pattern(), found, search.limit()));
        }
    }
}
