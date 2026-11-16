import java.util.List;
import maze.Level;
import maze.Levels;
import maze.Render;
import maze.Run;
import maze.Solver;

/** Prints the solver's routes for the sample levels. */
public class Main {
    public static void main(String[] args) {
        for (Level level : Levels.loadSamples()) {
            Run run = Solver.solve(level);
            System.out.println(Render.summary(level, run));
            System.out.println(Render.render(level, run != null ? run.path() : List.of()));
            if (!level.gems().isEmpty()) {
                try {
                    Run gemRun = Solver.collectAllGems(level);
                    System.out.println("  gem run: " + (gemRun != null ? gemRun.moves() : "impossible") + " moves");
                } catch (UnsupportedOperationException error) {
                    System.out.println("  gem run: " + error.getMessage());
                }
            }
            System.out.println();
        }
    }
}
