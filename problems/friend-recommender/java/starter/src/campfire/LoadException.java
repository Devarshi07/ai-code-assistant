package campfire;

/** A malformed export. The message names the file and line. */
public class LoadException extends IllegalArgumentException {
    public LoadException(String message) {
        super(message);
    }
}
