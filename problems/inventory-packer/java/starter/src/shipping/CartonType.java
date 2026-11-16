package shipping;

import java.util.Arrays;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Collectors;

/** Carton types stocked at the pack benches. */
public enum CartonType {
    SMALL("S", "Small box", 2000, 1500),
    MEDIUM("M", "Medium box", 5000, 3500),
    LARGE("L", "Large box", 10000, 7000);

    private final String code;
    private final String displayName;
    private final int maxWeightG;
    private final int fragileMaxWeightG;

    /**
     * @param maxWeightG carrier limit for the contents of one carton
     * @param fragileMaxWeightG lower limit once fragile padding goes in
     */
    CartonType(String code, String displayName, int maxWeightG, int fragileMaxWeightG) {
        this.code = code;
        this.displayName = displayName;
        this.maxWeightG = maxWeightG;
        this.fragileMaxWeightG = fragileMaxWeightG;
    }

    public String code() {
        return code;
    }

    public String displayName() {
        return displayName;
    }

    public int maxWeightG() {
        return maxWeightG;
    }

    public int fragileMaxWeightG() {
        return fragileMaxWeightG;
    }

    /** The stocked carton type with this code, ignoring case. */
    public static CartonType forCode(String code) {
        for (CartonType kind : values()) {
            if (kind.code.equalsIgnoreCase(code)) return kind;
        }
        String stocked = Arrays.stream(values()).map(CartonType::code).collect(Collectors.joining(", "));
        throw new IllegalArgumentException("unknown carton type '" + code + "'; stocked: " + stocked);
    }

    /** The smallest stocked carton type that holds weightG in one carton, if any does. */
    public static Optional<CartonType> smallestFor(int weightG, boolean fragile) {
        return Arrays.stream(values())
                .sorted(Comparator.comparingInt(CartonType::maxWeightG))
                .filter(kind -> weightG <= (fragile ? kind.fragileMaxWeightG : kind.maxWeightG))
                .findFirst();
    }

    public static Optional<CartonType> smallestFor(int weightG) {
        return smallestFor(weightG, false);
    }
}
