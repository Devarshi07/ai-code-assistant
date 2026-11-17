package com.debuggym.api.dto;

import com.debuggym.api.model.LedgerEntry;

import java.time.LocalDate;

public record StatementEntryResponse(String id, LedgerEntry.Type type, int points, int balanceAfter,
                                     String lotId, String redemptionId, LocalDate date) {
    public static StatementEntryResponse from(LedgerEntry e) {
        return new StatementEntryResponse(e.id(), e.type(), e.points(), e.balanceAfter(), e.lotId(), e.redemptionId(), e.date());
    }
}
