package com.debuggym.api.model;

import java.math.BigDecimal;
import java.time.Instant;

/** One entry in an account's ledger. transferId is set on both sides of a transfer. */
public record Transaction(String id, String accountId, TransactionType type, BigDecimal amount,
                          BigDecimal balanceAfter, String transferId, Instant createdAt) {
}
