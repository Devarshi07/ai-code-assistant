package kitchen;

import java.util.List;
import java.util.Map;

/**
 * Outcome of one simulated service.
 *
 * @param ready order id to the minute its last dish finished
 * @param late  late orders, ascending id
 */
public record KitchenRun(Map<Integer, Integer> ready, List<Late> late) {
    /** An order that was ready after its promised time. */
    public record Late(int id, int minutesLate) {}
}
