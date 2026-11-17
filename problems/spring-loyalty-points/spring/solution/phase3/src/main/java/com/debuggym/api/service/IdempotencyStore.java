package com.debuggym.api.service;

import com.debuggym.api.exception.ApiException;
import com.debuggym.api.model.Redemption;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Remembers the redemption each Idempotency-Key produced. The first request with
 * a key claims it atomically (putIfAbsent) and runs; requests that arrive while
 * it runs wait for its result instead of running again. Only successes are
 * kept: if the first attempt fails, the key is released so the client can retry.
 * In production the entries would expire and live in shared storage.
 */
@Component
public class IdempotencyStore {
    private record Entry(String fingerprint, CompletableFuture<Redemption> result) {
    }

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();

    public RedemptionOutcome run(String key, String fingerprint, Supplier<Redemption> action) {
        Entry mine = new Entry(fingerprint, new CompletableFuture<>());
        Entry existing = entries.putIfAbsent(key, mine);
        if (existing != null) {
            if (!existing.fingerprint().equals(fingerprint))
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "idempotency_key_reuse",
                        "This Idempotency-Key was already used for a different request");
            try {
                return new RedemptionOutcome(existing.result().join(), true);
            } catch (CompletionException e) {
                if (e.getCause() instanceof RuntimeException cause) throw cause;
                throw e;
            }
        }
        try {
            Redemption redemption = action.get();
            mine.result().complete(redemption);
            return new RedemptionOutcome(redemption, false);
        } catch (RuntimeException e) {
            entries.remove(key, mine);
            mine.result().completeExceptionally(e);
            throw e;
        }
    }
}
