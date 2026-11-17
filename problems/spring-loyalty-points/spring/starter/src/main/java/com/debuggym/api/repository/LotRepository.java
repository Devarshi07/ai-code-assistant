package com.debuggym.api.repository;

import com.debuggym.api.model.PointsLot;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory store of points lots, kept per member in the order they were earned.
 * The lots handed out are the stored objects themselves, so changing one
 * changes the store; a database-backed repository would write it back in save.
 */
@Repository
public class LotRepository {
    private final Map<String, List<PointsLot>> byMember = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public String nextId() {
        return "lot_" + sequence.incrementAndGet();
    }

    /** Stores a new lot, or does nothing for one that is already stored. */
    public PointsLot save(PointsLot lot) {
        List<PointsLot> list = byMember.computeIfAbsent(lot.getMemberId(), id -> new ArrayList<>());
        synchronized (list) {
            if (!list.contains(lot)) list.add(lot);
        }
        return lot;
    }

    /** The member's lots, oldest earned first. The list is a copy; the lots are not. */
    public List<PointsLot> findByMember(String memberId) {
        List<PointsLot> list = byMember.get(memberId);
        if (list == null) return List.of();
        synchronized (list) {
            return List.copyOf(list);
        }
    }
}
