package com.debuggym.api.repository;

import com.debuggym.api.model.Transaction;
import com.debuggym.api.model.TransactionType;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory ledger: an append-only list of entries per account. */
@Repository
public class TransactionRepository {
    private final Map<String, List<Transaction>> byAccount = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    /** Appends an entry to the account's ledger and returns it. */
    public Transaction append(String accountId, TransactionType type, BigDecimal amount, BigDecimal balanceAfter, String transferId) {
        Transaction entry = new Transaction("txn_" + sequence.incrementAndGet(), accountId, type, amount, balanceAfter, transferId, Instant.now());
        List<Transaction> ledger = byAccount.computeIfAbsent(accountId, id -> new ArrayList<>());
        synchronized (ledger) {
            ledger.add(entry);
        }
        return entry;
    }

    /** A copy of the account's ledger, oldest entry first. */
    public List<Transaction> findByAccount(String accountId) {
        List<Transaction> ledger = byAccount.get(accountId);
        if (ledger == null) return List.of();
        synchronized (ledger) {
            return List.copyOf(ledger);
        }
    }
}
