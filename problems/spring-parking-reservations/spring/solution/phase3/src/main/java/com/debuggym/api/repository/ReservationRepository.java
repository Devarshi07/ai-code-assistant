package com.debuggym.api.repository;

import com.debuggym.api.model.Reservation;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory reservation store, with an interval index per space: the space's
 * active reservations sorted by start. Active reservations on one space never
 * overlap, so sorted by start they are also sorted by end, and one lookup
 * answers "is this space free for [start, end)?" in O(log n).
 */
@Repository
public class ReservationRepository {
    private final Map<Long, Reservation> reservations = new ConcurrentHashMap<>();
    private final Map<Long, NavigableMap<Instant, Reservation>> activeBySpace = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public long nextId() {
        return sequence.incrementAndGet();
    }

    /** Stores a new reservation, or the new state of one that changed, and keeps the index current. */
    public Reservation save(Reservation reservation) {
        reservations.put(reservation.getId(), reservation);
        NavigableMap<Instant, Reservation> index = activeBySpace.computeIfAbsent(reservation.getSpaceId(), id -> new ConcurrentSkipListMap<>());
        if (reservation.isActive()) index.put(reservation.getStart(), reservation);
        else index.remove(reservation.getStart(), reservation);
        return reservation;
    }

    public Optional<Reservation> findById(long id) {
        return Optional.ofNullable(reservations.get(id));
    }

    /** Every reservation for the space, cancelled ones included. A full scan: keep it off hot paths. */
    public List<Reservation> findBySpace(long spaceId) {
        return reservations.values().stream().filter(r -> r.getSpaceId() == spaceId).toList();
    }

    /**
     * True when no active reservation on the space overlaps [start, end). Only the
     * reservation with the latest start before end can overlap: every earlier one
     * ends no later than that one starts.
     */
    public boolean isFree(long spaceId, Instant start, Instant end) {
        NavigableMap<Instant, Reservation> index = activeBySpace.get(spaceId);
        if (index == null) return true;
        Map.Entry<Instant, Reservation> latest = index.lowerEntry(end);
        return latest == null || !latest.getValue().overlaps(start, end);
    }
}
