package com.debuggym.api.model;

import java.time.LocalDate;

/**
 * One line of a member's statement. points is always positive; the type gives
 * the direction. lotId is set on EARN and EXPIRE, redemptionId on REDEEM.
 */
public record LedgerEntry(String id, String memberId, Type type, int points, int balanceAfter,
                          String lotId, String redemptionId, LocalDate date) {
    public enum Type { EARN, REDEEM, EXPIRE }
}
