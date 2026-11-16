package shipping;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Weight units.
 *
 * <p>Inside the service every weight is a whole number of grams. The WMS export
 * and the carrier labels use kilograms, so conversions happen only at the
 * edges: {@link #parseWeightKg} when an export is loaded, {@code format*} when
 * printing.
 */
public final class Units {
    public static final int GRAMS_PER_KG = 1000;

    // The pack-bench scales read to the gram, so the export never carries more
    // than three decimal places: "2", "0.5", "1.25", "0.035".
    private static final Pattern READING = Pattern.compile("\\d+(\\.\\d+)?");

    private Units() {
    }

    /** Convert a kilogram reading from the WMS export to whole grams. */
    public static int parseWeightKg(String text) {
        String cleaned = text == null ? "" : text.strip();
        if (!READING.matcher(cleaned).matches()) {
            throw new IllegalArgumentException("weight '" + text + "' is not a kilogram reading like 1.25");
        }
        double kilograms = Double.parseDouble(cleaned);
        // Binary floats store 2.03 as 2.02999..., so truncating would lose a gram.
        return (int) Math.round(kilograms * GRAMS_PER_KG);
    }

    /** 5435 -> "5,435 g" */
    public static String formatGrams(int grams) {
        return String.format(Locale.ROOT, "%,d g", grams);
    }

    /** 5435 -> "5.435 kg", the format printed on carrier labels. */
    public static String formatKg(int grams) {
        return String.format(Locale.ROOT, "%d.%03d kg", grams / GRAMS_PER_KG, grams % GRAMS_PER_KG);
    }
}
