package armada;

/** Thrown when a ship cannot be placed where requested. */
public class PlacementException extends IllegalArgumentException {
    public PlacementException(String message) {
        super(message);
    }
}
