package com.debuggym.api.service;

import com.debuggym.api.model.Space;
import com.debuggym.api.model.VehicleSize;
import com.debuggym.api.repository.ReservationRepository;
import com.debuggym.api.repository.SpaceRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AvailabilityService {
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
        throw new UnsupportedOperationException("Not implemented: availability search (phase 2)");
    }
}
