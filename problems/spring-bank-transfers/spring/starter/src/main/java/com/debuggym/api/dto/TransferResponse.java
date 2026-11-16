package com.debuggym.api.dto;

import com.debuggym.api.model.Transfer;
import com.debuggym.api.service.Money;

import java.time.Instant;

public record TransferResponse(String id, String fromAccountId, String toAccountId, String amount, String memo, Instant createdAt) {
    public static TransferResponse from(Transfer transfer) {
        return new TransferResponse(transfer.id(), transfer.fromAccountId(), transfer.toAccountId(), Money.format(transfer.amount()),
                transfer.memo(), transfer.createdAt());
    }
}
