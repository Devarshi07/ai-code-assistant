package kitchen;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Clock helpers for the kitchen display.
 *
 * <p>The ticket printer stamps every ticket with a 12-hour wall-clock time such
 * as "11:58am" or "1:05pm". Everything inside the kitchen model works in whole
 * minutes since midnight at the start of service: 0 is 12:00am, 750 is 12:30pm.
 * A late service can run past midnight, and those minutes keep counting up, so
 * 1450 is 12:10am the next day.
 */
public final class Clock {
    public static final int MINUTES_PER_DAY = 24 * 60;
    private static final Pattern STAMP = Pattern.compile("^\\s*(\\d{1,2}):(\\d{2})\\s*([ap]m)\\s*$", Pattern.CASE_INSENSITIVE);

    private Clock() {}

    /** Turn a printer stamp like "9:05am" or "6:30pm" into minutes since midnight. */
    public static int parseClock(String text) {
        Matcher match = STAMP.matcher(String.valueOf(text));
        if (!match.matches()) throw new ClockException("not a clock time: \"" + text + "\"");
        int hours = Integer.parseInt(match.group(1));
        int minutes = Integer.parseInt(match.group(2));
        if (hours < 1 || hours > 12 || minutes > 59) throw new ClockException("not a clock time: \"" + text + "\"");
        if (match.group(3).equalsIgnoreCase("pm")) hours += 12;
        return hours * 60 + minutes;
    }

    /** Inverse of parseClock: 750 gives "12:30pm". Later days get a "+N" marker. */
    public static String formatClock(int minutes) {
        int day = Math.floorDiv(minutes, MINUTES_PER_DAY);
        int minuteOfDay = minutes - day * MINUTES_PER_DAY;
        int hours = minuteOfDay / 60;
        int mins = minuteOfDay % 60;
        String half = hours < 12 ? "am" : "pm";
        String stamp = String.format("%d:%02d%s", hours % 12 == 0 ? 12 : hours % 12, mins, half);
        return day == 0 ? stamp : stamp + " +" + day;
    }

    /** Compact duration for reports: 7 gives "7m", 65 gives "1h05m". */
    public static String formatDuration(int minutes) {
        int hours = minutes / 60;
        int mins = minutes % 60;
        return hours == 0 ? mins + "m" : String.format("%dh%02dm", hours, mins);
    }
}
