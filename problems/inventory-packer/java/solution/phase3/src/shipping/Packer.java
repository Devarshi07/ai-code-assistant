package shipping;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Plans which carton each unit of an order goes into.
 *
 * <p>Packing rules agreed with the carriers:
 *
 * <ol>
 *   <li>The contents of a carton weigh at most {@code cartonType.maxWeightG()}.
 *   <li>Once a carton holds a fragile item, its contents weigh at most
 *       {@code cartonType.fragileMaxWeightG()} (the padding needs the headroom).
 *   <li>A hazmat item ships alone: nothing else goes in its carton.
 * </ol>
 */
public final class Packer {
    /** Room value for cartons nothing more may enter, and for unopened slots. */
    private static final int CLOSED = -1;

    private Packer() {
    }

    /**
     * Plan cartons of cartonType for items, following the bench rule.
     *
     * <p>Bench rule (first-fit decreasing): take units heaviest first, keeping
     * order-line order between equal weights, and put each one into the
     * earliest-opened carton that may legally take it. Open a new carton only
     * when none can.
     *
     * <p>Instead of scanning every open carton per unit, two segment trees track
     * how much more each carton may take: one for ordinary units (its current
     * limit minus its load) and one for fragile units (the fragile limit minus
     * its load). The leftmost slot with enough room is exactly the carton the
     * scan would have found, so the plan is identical, in O(n log n).
     *
     * <p>Returns the cartons in the order they are opened, numbered from 1.
     *
     * @throws PackingException if some item cannot ship in cartonType even on its own
     */
    public static List<Carton> packItems(List<Item> items, CartonType cartonType) {
        for (Item item : items) checkShippable(item, cartonType);
        int fragileLimit = cartonType.fragileMaxWeightG();
        RoomTree ordinaryRoom = new RoomTree(items.size());
        RoomTree fragileRoom = new RoomTree(items.size());
        List<Item> ordered = new ArrayList<>(items);
        ordered.sort(Comparator.comparingInt(Item::weightG).reversed());   // List.sort is stable
        List<Carton> cartons = new ArrayList<>();
        for (Item item : ordered) {
            int slot = -1;
            if (!item.hazmat()) slot = (item.fragile() ? fragileRoom : ordinaryRoom).leftmost(item.weightG());
            if (slot < 0) {
                slot = cartons.size();
                cartons.add(new Carton(cartonType, slot + 1));
            }
            Carton carton = cartons.get(slot);
            carton.add(item);
            if (carton.hazmat()) {
                ordinaryRoom.set(slot, CLOSED);
                fragileRoom.set(slot, CLOSED);
            } else {
                ordinaryRoom.set(slot, carton.limitG() - carton.weightG());
                fragileRoom.set(slot, fragileLimit - carton.weightG());
            }
        }
        return cartons;
    }

    /**
     * Max segment tree over carton slots, answering "leftmost slot with room >= need".
     *
     * <p>Slots are carton positions in opening order. Both set() and leftmost()
     * are O(log n), which keeps the bench rule's "earliest carton that fits"
     * cheap even with tens of thousands of open cartons.
     */
    private static final class RoomTree {
        private final int size;
        private final int[] best;

        RoomTree(int slots) {
            int size = 1;
            while (size < Math.max(slots, 1)) size *= 2;
            this.size = size;
            this.best = new int[2 * size];
            Arrays.fill(best, CLOSED);
        }

        void set(int slot, int room) {
            int node = slot + size;
            best[node] = room;
            for (node >>= 1; node > 0; node >>= 1) {
                int top = Math.max(best[2 * node], best[2 * node + 1]);
                if (best[node] == top) break;   // nothing above this node changes either
                best[node] = top;
            }
        }

        /** Index of the leftmost slot with room >= need, or -1 if none has. */
        int leftmost(int need) {
            if (best[1] < need) return -1;
            int node = 1;
            while (node < size) {
                node *= 2;
                if (best[node] < need) node += 1;
            }
            return node - size;
        }
    }

    /** Throw PackingException if item is too heavy for cartonType even alone. */
    private static void checkShippable(Item item, CartonType cartonType) {
        int limit = item.fragile() ? cartonType.fragileMaxWeightG() : cartonType.maxWeightG();
        if (item.weightG() > limit) {
            throw new PackingException(item.sku() + " weighs " + Units.formatGrams(item.weightG()) + "; a "
                    + cartonType.displayName() + " takes at most " + Units.formatGrams(limit)
                    + (item.fragile() ? " when fragile" : ""));
        }
    }

    /** Plan cartons for every unit of an order. */
    public static List<Carton> packOrder(Order order, CartonType cartonType) {
        return packItems(order.units(), cartonType);
    }
}
