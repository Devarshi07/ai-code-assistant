package com.debuggym.api.model;

import java.time.LocalDate;

/**
 * Points earned by one purchase. A lot is spent down over time (remaining) and
 * expires as a whole on expiresOn, whatever is left of it.
 */
public class PointsLot {
    private final String id;
    private final String memberId;
    private final LocalDate earnedOn;
    private final LocalDate expiresOn;
    private final int originalPoints;
    private int remaining;

    public PointsLot(String id, String memberId, LocalDate earnedOn, LocalDate expiresOn, int points) {
        this.id = id;
        this.memberId = memberId;
        this.earnedOn = earnedOn;
        this.expiresOn = expiresOn;
        this.originalPoints = points;
        this.remaining = points;
    }

    public String getId() { return id; }
    public String getMemberId() { return memberId; }
    public LocalDate getEarnedOn() { return earnedOn; }
    public LocalDate getExpiresOn() { return expiresOn; }
    public int getOriginalPoints() { return originalPoints; }
    public int getRemaining() { return remaining; }

    public void setRemaining(int remaining) { this.remaining = remaining; }

    /** True from the expiry date onward: on that day the lot is already gone. */
    public boolean isExpiredOn(LocalDate today) {
        return !today.isBefore(expiresOn);
    }
}
