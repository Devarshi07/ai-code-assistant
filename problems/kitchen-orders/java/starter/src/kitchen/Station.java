package kitchen;

/** A station of the kitchen line, staffed by identical cooks working side by side. */
public record Station(String name, int cooks) {
    public Station {
        if (cooks < 1) throw new IllegalArgumentException("station " + name + " needs at least one cook");
    }
}
