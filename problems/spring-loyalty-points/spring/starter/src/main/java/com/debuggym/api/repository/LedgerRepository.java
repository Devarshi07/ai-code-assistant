package com.debuggym.api.repository;

import com.debuggym.api.model.LedgerEntry;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory statement storage: an append-only list of entries per member. */
@Repository
public class LedgerRepository {
    private final Map<String, List<LedgerEntry>> byMember = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public String nextRedemptionId() {
        return "red_" + sequence.incrementAndGet();
    }

    /** Appends an entry to the member's statement and returns it. */
    public LedgerEntry append(String memberId, LedgerEntry.Type type, int points, int balanceAfter,
                              String lotId, String redemptionId, LocalDate date) {
        LedgerEntry entry = new LedgerEntry("ent_" + sequence.incrementAndGet(), memberId, type, points, balanceAfter,
                lotId, redemptionId, date);
        List<LedgerEntry> list = byMember.computeIfAbsent(memberId, id -> new ArrayList<>());
        synchronized (list) {
            list.add(entry);
        }
        return entry;
    }

    /** A copy of the member's statement, oldest entry first. */
    public List<LedgerEntry> findByMember(String memberId) {
        List<LedgerEntry> list = byMember.get(memberId);
        if (list == null) return List.of();
        synchronized (list) {
            return List.copyOf(list);
        }
    }
}
