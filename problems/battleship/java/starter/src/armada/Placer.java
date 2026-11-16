package armada;

import java.util.Comparator;
import java.util.List;

/**
 * Seeded random fleets for bot benchmarks.
 *
 * <p>QA replays the same matches in the harness of every language the studio
 * uses, so a seed must produce the identical fleet in all of them. No
 * language's built-in random generator can promise that, so we use
 * mulberry32: a tiny 32-bit generator that ports bit-for-bit.
 */
public final class Placer {
    private static final int MAX_ATTEMPTS = 1000;

    private Placer() {
    }

    /** mulberry32. Same seed, same sequence, in every harness. */
    public static final class Rng {
        private int state;

        public Rng(int seed) {
            this.state = seed;
        }

        /** The next 32-bit output, as an unsigned value. */
        public long nextU32() {
            state += 0x6D2B79F5;
            int t = state;
            t = (t ^ (t >>> 15)) * (t | 1);
            t = (t + (t ^ (t >>> 7)) * (t | 61)) ^ t;
            return (t ^ (t >>> 14)) & 0xFFFFFFFFL;
        }

        /** An integer in [0, n). The modulo bias is negligible for board-sized n. */
        public int below(int n) {
            return (int) (nextU32() % n);
        }
    }

    public static Fleet randomFleet(int seed) {
        return randomFleet(seed, 10, Fleet.DEFAULT_FLEET);
    }

    public static Fleet randomFleet(int seed, int size) {
        return randomFleet(seed, size, Fleet.DEFAULT_FLEET);
    }

    /**
     * Places ships largest first, each at a random spot where it fits.
     * For each attempt the generator draws the orientation, then the row, then
     * the column. Every other harness draws in the same order.
     */
    public static Fleet randomFleet(int seed, int size, List<Integer> shipSizes) {
        Rng rng = new Rng(seed);
        Fleet fleet = new Fleet(new Ocean(size));
        for (int length : shipSizes.stream().sorted(Comparator.reverseOrder()).toList()) {
            if (length > size) throw new PlacementException("a " + length + "-cell ship cannot fit on a " + size + "x" + size + " board");
            int span = size - length + 1;
            boolean placed = false;
            for (int attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
                boolean vertical = rng.below(2) == 1;
                int row = rng.below(vertical ? span : size);
                int col = rng.below(vertical ? size : span);
                if (fleet.fits(length, new Coord(row, col), vertical)) {
                    fleet.place(length, new Coord(row, col), vertical);
                    placed = true;
                }
            }
            if (!placed) throw new PlacementException("seed " + seed + ": no room for a " + length + "-cell ship after " + MAX_ATTEMPTS + " attempts");
        }
        return fleet;
    }
}
