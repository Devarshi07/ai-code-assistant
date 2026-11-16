package com.debuggym.api.model;

import java.math.BigDecimal;
import java.time.Instant;

/** Money moved from one account to another. */
public record Transfer(String id, String fromAccountId, String toAccountId, BigDecimal amount,
                       String memo, Instant createdAt) {
}
