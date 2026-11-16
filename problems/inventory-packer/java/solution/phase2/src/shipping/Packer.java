package shipping;

import java.util.ArrayList;
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
     * <p>Returns the cartons in the order they are opened, numbered from 1.
     *
     * @throws PackingException if some item cannot ship in cartonType even on its own
     */
    public static List<Carton> packItems(List<Item> items, CartonType cartonType) {
        for (Item item : items) checkShippable(item, cartonType);
        List<Item> ordered = new ArrayList<>(items);
        ordered.sort(Comparator.comparingInt(Item::weightG).reversed());   // List.sort is stable
        List<Carton> cartons = new ArrayList<>();
        for (Item item : ordered) {
            Carton carton = null;
            for (Carton open : cartons) {
                if (canTake(open, item)) {
                    carton = open;
                    break;
                }
            }
            if (carton == null) {
                carton = new Carton(cartonType, cartons.size() + 1);
                cartons.add(carton);
            }
            carton.add(item);
        }
        return cartons;
    }

    /** True if the packing rules allow item into carton as it stands. */
    static boolean canTake(Carton carton, Item item) {
        if (carton.hazmat() || item.hazmat()) return false;
        CartonType kind = carton.cartonType();
        int limit = carton.fragile() || item.fragile() ? kind.fragileMaxWeightG() : kind.maxWeightG();
        return carton.weightG() + item.weightG() <= limit;
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
