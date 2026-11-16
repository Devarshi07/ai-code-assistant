package transit;

import java.util.List;

/** A planned trip: legs in travel order and the transfer penalty used to plan it. */
public record Journey(String origin, String destination, List<Leg> legs, int transferMinutes) {
    public Journey {
        legs = List.copyOf(legs);
    }

    public int transfers() {
        return Math.max(legs.size() - 1, 0);
    }

    public int ridingMinutes() {
        return legs.stream().mapToInt(Leg::minutes).sum();
    }

    public int totalMinutes() {
        return ridingMinutes() + transfers() * transferMinutes;
    }
}
