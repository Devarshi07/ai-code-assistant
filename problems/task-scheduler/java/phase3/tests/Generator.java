package tests;

import foundry.Schedule;
import foundry.Slot;
import foundry.Task;
import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic pipeline generator for the scale tests (xorshift32 PRNG). It
 * is the same generator as the other language versions, so a seed always gives
 * the same tasks.
 */
final class Generator {
    private static final String[] KINDS = {"build", "test", "lint", "pack", "scan", "docs", "bench", "deploy"};

    private Generator() {}

    /** A small 32-bit PRNG. */
    private static final class Xorshift32 {
        private int state;

        Xorshift32(long seed) {
            state = seed == 0 ? 0x9e3779b9 : (int) seed;
        }

        long next() {
            int x = state;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            state = x;
            return x & 0xFFFFFFFFL;
        }

        int below(int n) {
            return (int) (next() % n);
        }
    }

    /** {@code count} tasks; each depends on up to 3 of the {@code window} tasks before it. */
    static List<Task> generatePipeline(long seed, int count, int window) {
        final int maxDeps = 3;
        final int maxDuration = 20;
        Xorshift32 rng = new Xorshift32(seed);
        List<String> names = new ArrayList<>();
        List<Task> tasks = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            String name = KINDS[rng.below(KINDS.length)] + "-" + i;
            List<String> deps = new ArrayList<>();
            if (i > 0) {
                int low = Math.max(0, i - window);
                int k = rng.below(maxDeps + 1);
                for (int j = 0; j < k; j++) {
                    String dep = names.get(low + rng.below(i - low));
                    if (!deps.contains(dep)) deps.add(dep);
                }
            }
            tasks.add(new Task(name, 1 + rng.below(maxDuration), deps));
            names.add(name);
        }
        return tasks;
    }

    /** Fold every task's (start, runner) into one number, in generation order. */
    static long fingerprint(List<Task> tasks, Schedule plan) {
        long acc = 0;
        for (Task task : tasks) {
            Slot s = plan.slotFor(task.name());
            acc = (acc * 1000003 + s.start() * 1024L + s.worker()) % 2147483647;
        }
        return acc;
    }
}
