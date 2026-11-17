package tests;

/**
 * Deterministic random pictures for the large-puzzle tests.
 *
 * Uses the Park-Miller "minimal standard" generator, so every language's
 * tests reproduce exactly the same pictures. The seeds used in Phase3Test
 * were checked offline: each picture is the *only* grid that fits its clues.
 */
final class Generator {
    private static final long MODULUS = 2147483647L;

    private Generator() {}

    /** A width x height grid where each cell is filled with probability density. */
    static int[][] randomPicture(long seed, int width, int height, double density) {
        long state = seed % MODULUS;
        if (state == 0) state = 1;
        int[][] grid = new int[height][width];
        for (int r = 0; r < height; r++) {
            for (int c = 0; c < width; c++) {
                state = (state * 48271L) % MODULUS;
                grid[r][c] = (double) state / MODULUS < density ? 1 : 0;
            }
        }
        return grid;
    }
}
