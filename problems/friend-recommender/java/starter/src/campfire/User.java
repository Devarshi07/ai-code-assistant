package campfire;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * One Campfire member. Members are identified by their handle, {@code id}.
 *
 * <p>The static helpers validate and parse the fields of a member record; the
 * loaders share them.
 */
public final class User {
    private static final Pattern ID_PATTERN = Pattern.compile("[a-z][a-z0-9_]{1,31}");
    private static final List<String> MONTHS = List.of(
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");

    private final String id;
    private final String name;
    private final LocalDate joined;
    private final Set<String> interests;
    private boolean active = true;

    public User(String id, String name, LocalDate joined, Collection<String> interests) {
        this.id = checkId(id);
        if (name == null || name.isBlank()) throw new ModelException(id + ": name must not be empty");
        this.name = name;
        this.joined = joined;
        this.interests = Collections.unmodifiableSet(new LinkedHashSet<>(interests));
    }

    public User(String id, String name, LocalDate joined) {
        this(id, name, joined, List.of());
    }

    public String id() {
        return id;
    }

    public String name() {
        return name;
    }

    public LocalDate joined() {
        return joined;
    }

    /** The member's interest tags, read-only. */
    public Set<String> interests() {
        return interests;
    }

    /** Deactivated members keep their friendships but are never suggested. */
    public boolean isActive() {
        return active;
    }

    void deactivate() {
        active = false;
    }

    public String firstName() {
        return name.strip().split("\\s+")[0];
    }

    /** "Apr 2019". */
    public String memberSince() {
        return MONTHS.get(joined.getMonthValue() - 1) + " " + joined.getYear();
    }

    @Override
    public String toString() {
        return name + " (@" + id + ")";
    }

    // -- parsing helpers ------------------------------------------------------

    /** Returns userId if it is a valid Campfire handle, else throws ModelException. */
    public static String checkId(String userId) {
        if (userId == null || !ID_PATTERN.matcher(userId).matches()) {
            throw new ModelException("invalid member id '" + userId + "'");
        }
        return userId;
    }

    /** "  Board Games " -> "board-games". */
    public static String normalizeInterest(String tag) {
        return String.join("-", tag.toLowerCase().strip().split("\\s+"));
    }

    /** Parses a ';'-separated interest list into a set of normalized tags. */
    public static Set<String> parseInterests(String text) {
        Set<String> tags = new LinkedHashSet<>();
        for (String tag : text.split(";")) {
            if (!tag.isBlank()) tags.add(normalizeInterest(tag));
        }
        return tags;
    }

    /** Parses a YYYY-MM-DD date from an export. */
    public static LocalDate parseDate(String text) {
        try {
            return LocalDate.parse(text.strip());
        } catch (DateTimeParseException e) {
            throw new ModelException("invalid date '" + text + "'; expected YYYY-MM-DD");
        }
    }
}
