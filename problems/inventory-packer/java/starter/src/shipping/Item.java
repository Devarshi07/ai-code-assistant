package shipping;

import java.util.ArrayList;
import java.util.List;

/**
 * One sellable unit as listed in the catalogue.
 *
 * <p>{@code weightG} is the packed weight of a single unit, in whole grams.
 * Fragile items need padding, which lowers the load a carton may carry.
 * Hazmat items (batteries, aerosols, solvents) ship in a carton of their own.
 */
public record Item(String sku, String description, int weightG, boolean fragile, boolean hazmat) {
    public Item {
        if (sku == null || sku.isEmpty()) {
            throw new IllegalArgumentException("an item needs a SKU");
        }
        if (weightG < 1) {
            throw new IllegalArgumentException(sku + ": weight must be a whole number of grams, at least 1");
        }
    }

    /** An item with no handling flags. */
    public Item(String sku, String description, int weightG) {
        this(sku, description, weightG, false, false);
    }

    public List<String> flags() {
        List<String> flags = new ArrayList<>();
        if (fragile) flags.add("fragile");
        if (hazmat) flags.add("hazmat");
        return flags;
    }
}
