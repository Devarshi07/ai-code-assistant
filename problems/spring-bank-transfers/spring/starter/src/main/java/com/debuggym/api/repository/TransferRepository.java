package com.debuggym.api.repository;

import com.debuggym.api.model.Transfer;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory transfer store. */
@Repository
public class TransferRepository {
    private final Map<String, Transfer> transfers = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public String nextId() {
        return "tr_" + sequence.incrementAndGet();
    }

    public Transfer save(Transfer transfer) {
        transfers.put(transfer.id(), transfer);
        return transfer;
    }

    public Optional<Transfer> findById(String id) {
        return Optional.ofNullable(transfers.get(id));
    }
}
