package fifteens;

/**
 * 32-bit linear congruential generator (Numerical Recipes constants).
 *
 * <p>The JavaScript client implements the same arithmetic, so both produce the same sequence for
 * the same seed. Java's {@code int} arithmetic wraps around modulo 2^32, which is exactly the
 * generator's modulus; only reading the state needs it as an unsigned number.
 */
public final class SeededRandom {
    private int state;

    public SeededRandom(int seed) {
        this.state = seed;
    }

    /** Advance the generator and return its new state, from 0 to 2^32 - 1. */
    public long nextUint32() {
        state = state * 1664525 + 1013904223;
        return Integer.toUnsignedLong(state);
    }

    /** An integer in [0, n), taken from the high bits of the next value. */
    public int below(int n) {
        return (int) ((nextUint32() * n) >>> 32);
    }
}
