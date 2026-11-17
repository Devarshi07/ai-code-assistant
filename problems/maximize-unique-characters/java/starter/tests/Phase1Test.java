package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import oneofeach.Board;
import oneofeach.Puzzle;
import oneofeach.Solver;
import oneofeach.Validator;
import oneofeach.Word;
import oneofeach.WordList;
import oneofeach.WordListException;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final String SAMPLE_LIST = """

            # word     difficulty  themes
            Tango      2           music, dance
            otter      1           animals
            fig        1           kitchen, garden
            jam        1           kitchen, music
            quiche     3           kitchen
            """;

    static List<String> texts(List<Word> words) {
        return words.stream().map(Word::text).toList();
    }

    @Nested
    class ValidatorTests {
        @Test
        void cleanBoardHasNoProblems() {
            assertEquals(List.of(), Validator.selectionProblems(List.of("zebra", "lynx", "dog")));
            assertTrue(Validator.isValidSelection(List.of("zebra", "lynx", "dog")));
        }

        @Test
        void wordsSharingALetterAreRejected() {
            List<String> problems = Validator.selectionProblems(List.of("drum", "harp"));
            assertEquals(1, problems.size());
            assertTrue(problems.get(0).contains("'r'"), problems.get(0));
        }

        @Test
        void clashReportNamesEveryEarlierWord() {
            List<String> problems = Validator.selectionProblems(List.of("drum", "harp", "tempo"));
            assertEquals(2, problems.size());
            assertTrue(problems.get(1).contains("'drum'") && problems.get(1).contains("'harp'"), problems.get(1));
        }

        @Test
        void reportedKitchenBoardIsRejected() {
            // Player report for 2026-10-12: "today's board has two Ts".
            assertFalse(Validator.isValidSelection(List.of("butter", "fig", "jam", "wok")));
        }

        @Test
        void doubleLetterProblemNamesTheLetter() {
            List<String> problems = Validator.selectionProblems(List.of("moss", "fern"));
            assertEquals(1, problems.size());
            assertTrue(problems.get(0).contains("'moss'") && problems.get(0).contains("'s'"), problems.toString());
        }

        @Test
        void letterUsedThreeTimesInOneWord() {
            assertFalse(Validator.isValidSelection(List.of("bobbin")));
        }
    }

    @Nested
    class PuzzleTests {
        @Test
        void tileCountCountsEveryTile() {
            Puzzle puzzle = new Puzzle("2026-10-12", "kitchen", List.of("butter", "fig", "jam", "wok"));
            assertEquals(15, puzzle.tileCount());
            assertTrue(Board.render(puzzle).contains("15 tiles"), Board.render(puzzle));
        }

        @Test
        void unusedLetters() {
            Puzzle puzzle = new Puzzle("2026-10-14", "animals", List.of("zebra", "lynx", "dog"));
            assertEquals(12, puzzle.tileCount());
            assertEquals("cfhijkmpqstuvw", puzzle.unusedLetters());
        }
    }

    @Nested
    class WordListTests {
        @Test
        void parseReadsDifficultyAndThemes() {
            List<Word> words = WordList.parse(SAMPLE_LIST);
            assertEquals(List.of("tango", "otter", "fig", "jam", "quiche"), texts(words));
            assertEquals(2, words.get(0).difficulty());
            assertEquals(List.of("dance", "music"), List.copyOf(words.get(0).tags()));
        }

        @Test
        void filterByThemeAndDifficulty() {
            List<Word> words = WordList.parse(SAMPLE_LIST);
            assertEquals(List.of("fig", "jam", "quiche"), texts(WordList.filter(words, "kitchen", null)));
            assertEquals(List.of("fig", "jam"), texts(WordList.filter(words, "kitchen", 2)));
        }

        @Test
        void badWordReportsItsLine() {
            WordListException error = assertThrows(WordListException.class,
                    () -> WordList.parse("fig 1 kitchen\nrock'n'roll 2 music\n"));
            assertTrue(error.getMessage().contains("line 2"), error.getMessage());
        }

        @Test
        void playableWordsSkipDoubleLettersAndDuplicates() {
            List<Word> words = WordList.parse(SAMPLE_LIST + "fig 2 snacks\n");
            assertEquals(List.of("tango", "fig", "jam", "quiche"), texts(Solver.playableWords(words)));
        }
    }
}
