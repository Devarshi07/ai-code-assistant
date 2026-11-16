package shipping;

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
     * <p>Returns the cartons in the order they are opened, numbered from 1.
     *
     * @throws PackingException if some item cannot ship in cartonType even on its own
     */
    public static List<Carton> packItems(List<Item> items, CartonType cartonType) {
        throw new UnsupportedOperationException("Phase 2: packItems is not implemented yet");
    }

    /** Plan cartons for every unit of an order. */
    public static List<Carton> packOrder(Order order, CartonType cartonType) {
        return packItems(order.units(), cartonType);
    }
}
