package tests;

import java.util.ArrayList;
import java.util.List;
import shipping.Item;

/** Deterministic wholesale orders for the scale tests. */
final class Generator {
    /** Park-Miller "minimal standard" generator. The other language versions use the same one. */
    static final class Lcg {
        private long state;

        Lcg(long seed) {
            state = seed % 2147483647;
            if (state == 0) state = 1;
        }

        int below(int n) {
            state = state * 48271 % 2147483647;
            return (int) (state % n);
        }
    }

    private Generator() {
    }

    /** count units of a restock order: random catalogue lines, each ordered in bulk. */
    static List<Item> wholesaleUnits(long seed, int count) {
        return wholesaleUnits(seed, count, 400, 4900, 3400);
    }

    static List<Item> wholesaleUnits(long seed, int count, int catalogueSize, int maxG, int fragileMaxG) {
        Lcg rng = new Lcg(seed);
        List<Item> catalogue = new ArrayList<>();
        for (int n = 0; n < catalogueSize; n++) {
            int roll = rng.below(100);
            boolean hazmat = roll < 2;
            boolean fragile = roll >= 2 && roll < 20;
            int top = fragile ? fragileMaxG : maxG;
            catalogue.add(new Item(String.format("W%04d", n), "wholesale line " + n, 60 + rng.below(top - 59), fragile, hazmat));
        }
        List<Item> units = new ArrayList<>(count);
        while (units.size() < count) {
            Item item = catalogue.get(rng.below(catalogueSize));
            int quantity = Math.min(1 + rng.below(40), count - units.size());
            for (int i = 0; i < quantity; i++) units.add(item);
        }
        return units;
    }
}
