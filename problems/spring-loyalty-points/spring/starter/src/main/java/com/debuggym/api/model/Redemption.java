package com.debuggym.api.model;

import java.time.LocalDate;
import java.util.List;

/** The result of spending points: what was spent, from which lots, and the balance left. */
public record Redemption(String id, String memberId, String rewardId, int quantity, int pointsSpent,
                         int balance, List<LotUse> lots, LocalDate date) {
    /** How many points one lot gave to this redemption. */
    public record LotUse(String lotId, int points, LocalDate expiresOn) {
    }
}
