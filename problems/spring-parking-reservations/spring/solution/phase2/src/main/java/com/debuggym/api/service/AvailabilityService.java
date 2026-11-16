package com.debuggym.api.service;

import com.debuggym.api.model.Reservation;
import com.debuggym.api.model.Space;
import com.debuggym.api.model.VehicleSize;
import com.debuggym.api.repository.ReservationRepository;
import com.debuggym.api.repository.SpaceRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class AvailabilityService {
    /** Smallest space that fits first, so large spaces stay free for large vehicles; then lower levels, then id. */
    public static final Comparator<Space> BEST_FIT = Comparator.comparing(Space::size).thenComparingInt(Space::level).thenComparingLong(Space::id);

    private final SpaceRepository spaces;
    private final ReservationRepository reservations;

    public AvailabilityService(SpaceRepository spaces, ReservationRepository reservations) {
        this.spaces = spaces;
        this.reservations = reservations;
    }

    /**
     * The spaces a vehicle of this size fits in that are free for the whole
     * window [start, end), best fit first (see the README for the order).
     */
    public List<Space> findAvailable(Instant start, Instant end, VehicleSize vehicleSize) {
        Windows.check(start, end);
        List<Space> free = new ArrayList<>();
        for (Space space : spaces.findAll()) {
            if (!vehicleSize.fitsIn(space.size())) continue;
            boolean taken = false;
            for (Reservation r : reservations.findBySpace(space.id()))
                if (r.isActive() && r.overlaps(start, end)) {
                    taken = true;
                    break;
                }
            if (!taken) free.add(space);
        }
        free.sort(BEST_FIT);
        return free;
    }
}
