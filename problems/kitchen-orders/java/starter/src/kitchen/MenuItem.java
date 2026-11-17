package kitchen;

/**
 * A dish, the one station that cooks it, and its prep time. Every dish is
 * cooked start to finish by one cook; prep times are whole minutes of
 * hands-on cooking time.
 */
public record MenuItem(String name, String station, int prep) {
    public MenuItem {
        if (prep < 1) throw new IllegalArgumentException(name + ": prep time must be at least one minute");
    }
}
