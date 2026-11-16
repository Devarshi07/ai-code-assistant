package com.debuggym.api.service;

import com.debuggym.api.exception.ValidationFailedException;

import java.time.Duration;
import java.time.Instant;

/** Rules every time window follows, for bookings and searches alike. */
public final class Windows {
    public static final Duration MAX_LENGTH = Duration.ofDays(14);

    private Windows() {
    }

    public static void check(Instant start, Instant end) {
        if (!end.isAfter(start)) throw new ValidationFailedException("end", "must be after start");
        if (Duration.between(start, end).compareTo(MAX_LENGTH) > 0)
            throw new ValidationFailedException("end", "a window can be at most " + MAX_LENGTH.toDays() + " days long");
    }
}
