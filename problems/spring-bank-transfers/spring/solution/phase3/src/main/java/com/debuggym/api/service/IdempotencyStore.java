package com.debuggym.api.service;

import com.debuggym.api.exception.ApiException;
import com.debuggym.api.model.Transfer;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Remembers the transfer each Idempotency-Key produced. The first request with
 * a key claims it atomically (putIfAbsent) and runs; requests that arrive while
 * it runs wait for its result instead of running again. Only successes are
 * kept: if the first attempt fails, the key is released so the client can retry.
 * In production the entries would expire (24 hours, say) and live in shared storage.
 */
@Component
public class IdempotencyStore {
    private record Entry(String fingerprint, CompletableFuture<Transfer> result) {
    }

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();

    public TransferOutcome run(String key, String fingerprint, Supplier<Transfer> action) {
        Entry mine = new Entry(fingerprint, new CompletableFuture<>());
        Entry existing = entries.putIfAbsent(key, mine);
        if (existing != null) {
            if (!existing.fingerprint().equals(fingerprint))
                throw new ApiException(HttpStatus.CONFLICT, "idempotency_conflict", "This Idempotency-Key was already used for a different transfer");
            try {
                return new TransferOutcome(existing.result().join(), true);
            } catch (CompletionException e) {
                if (e.getCause() instanceof RuntimeException cause) throw cause;
                throw e;
            }
        }
        try {
            Transfer transfer = action.get();
            mine.result().complete(transfer);
            return new TransferOutcome(transfer, false);
        } catch (RuntimeException e) {
            entries.remove(key, mine);
            mine.result().completeExceptionally(e);
            throw e;
        }
    }
}
