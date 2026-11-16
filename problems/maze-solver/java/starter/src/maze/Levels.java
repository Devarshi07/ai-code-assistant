package maze;

import java.util.List;

/** Sample levels from the designers' shared folder. */
public final class Levels {
    public static final String TUTORIAL = """
            #########
            #S..#...#
            #.#.#.#.#
            #.#...#E#
            #########
            """;

    public static final String GATEHOUSE = """
            ###########
            #S...>...E#
            #.#######.#
            #....<....#
            ###########
            """;

    public static final String TREASURY = """
            ###########
            #S..#....$#
            #.#.#.###.#
            #.#$..#...#
            #.#####.#.#
            #...$...#E#
            ###########
            """;

    public static final String CANYON = """
            ###############
            #S....#.......#
            #.###.#.#####.#
            #...#...#...#.#
            ###.#####.#.#.#
            #.........#..E#
            ###############
            """;

    public static final String TOWER = """
            #####
            #S..#
            #.#.#
            #.#.#
            #...#
            ##.##
            #..$#
            #.###
            #..E#
            #####
            """;

    public static final String SPIRE = """
            #####
            #S...
            ###.#
            #...#
            #.###
            #...#
            ###.#
            #...#
            #.###
            #...#
            ###.#
            #E...
            """;

    private Levels() {}

    public static List<Level> loadSamples() {
        return List.of(
                Level.parse(TUTORIAL, "tutorial"),
                Level.parse(GATEHOUSE, "gatehouse"),
                Level.parse(TREASURY, "treasury"),
                Level.parse(CANYON, "canyon"),
                Level.parse(TOWER, "tower"),
                Level.parse(SPIRE, "spire"));
    }
}
