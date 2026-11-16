package transit;

/** A directed edge in the network: from some station, ride {@code line} to {@code to}. */
public record Connection(String to, String line, int minutes) {
}
