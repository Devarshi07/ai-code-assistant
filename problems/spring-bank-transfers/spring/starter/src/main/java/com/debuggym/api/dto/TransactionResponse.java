package com.debuggym.api.dto;

import com.debuggym.api.model.Transaction;
import com.debuggym.api.model.TransactionType;
import com.debuggym.api.service.Money;

import java.time.Instant;

public record TransactionResponse(String id, TransactionType type, String amount, String balanceAfter,
                                  String transferId, Instant createdAt) {
    public static TransactionResponse from(Transaction entry) {
        return new TransactionResponse(entry.id(), entry.type(), Money.format(entry.amount()), Money.format(entry.balanceAfter()),
                entry.transferId(), entry.createdAt());
    }
}
