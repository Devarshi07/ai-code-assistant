package com.debuggym.api;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** A clock the tests can move: setDate("2026-03-15") makes it 10:00 UTC on that day. */
public class MutableClock extends Clock {
    private volatile Instant now = Instant.parse("2025-01-01T10:00:00Z");

    public void setDate(String isoDate) {
        now = LocalDate.parse(isoDate).atTime(10, 0).toInstant(ZoneOffset.UTC);
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        return now;
    }
}
