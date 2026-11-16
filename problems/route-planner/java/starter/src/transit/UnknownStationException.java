package transit;

import java.util.NoSuchElementException;

/** Thrown when a query names a station that is not in the network. */
public class UnknownStationException extends NoSuchElementException {
    private final String station;

    public UnknownStationException(String station) {
        super("unknown station: '" + station + "'");
        this.station = station;
    }

    public String station() {
        return station;
    }
}
