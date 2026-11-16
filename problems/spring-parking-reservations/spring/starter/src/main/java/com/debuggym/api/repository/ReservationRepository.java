package com.debuggym.api.repository;

import com.debuggym.api.model.Reservation;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory reservation store. Reservations are never deleted, only cancelled. */
@Repository
public class ReservationRepository {
    private final Map<Long, Reservation> reservations = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public long nextId() {
        return sequence.incrementAndGet();
    }

    /** Stores a new reservation, or the new state of one that changed. */
    public Reservation save(Reservation reservation) {
        reservations.put(reservation.getId(), reservation);
        return reservation;
    }

    public Optional<Reservation> findById(long id) {
        return Optional.ofNullable(reservations.get(id));
    }

    /** Every reservation for the space, cancelled ones included, in no particular order. */
    public List<Reservation> findBySpace(long spaceId) {
        return reservations.values().stream().filter(r -> r.getSpaceId() == spaceId).toList();
    }
}
