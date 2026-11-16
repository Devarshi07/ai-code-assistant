package shipping;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A carton at the pack bench.
 *
 * <p>Carton only keeps the books. Deciding what may go in which carton is the
 * packer's job (see {@link Packer}).
 */
public final class Carton {
    private final CartonType cartonType;
    private final int number;                            // 1-based position in the shipment
    private final List<Item> items = new ArrayList<>();  // in the order they were packed
    private int weightG;
    private boolean fragile;                             // holds at least one fragile item
    private boolean hazmat;                              // holds a hazmat item

    public Carton(CartonType cartonType, int number) {
        this.cartonType = cartonType;
        this.number = number;
    }

    public CartonType cartonType() {
        return cartonType;
    }

    public int number() {
        return number;
    }

    /** The units inside, in the order they were packed (read-only). */
    public List<Item> items() {
        return Collections.unmodifiableList(items);
    }

    public int weightG() {
        return weightG;
    }

    public boolean fragile() {
        return fragile;
    }

    public boolean hazmat() {
        return hazmat;
    }

    /** Most the contents may weigh, given what is already inside. */
    public int limitG() {
        return fragile ? cartonType.fragileMaxWeightG() : cartonType.maxWeightG();
    }

    public int remainingG() {
        return limitG() - weightG;
    }

    public void add(Item item) {
        items.add(item);
        weightG += item.weightG();
        fragile = fragile || item.fragile();
        hazmat = hazmat || item.hazmat();
    }

    @Override
    public String toString() {
        return "Carton(" + cartonType.code() + "#" + number + ", " + items.size() + " items, " + weightG + " g)";
    }
}
