package com.debuggym.api.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** A completed purchase, in currency units with at most two decimals (12.50). */
public record PurchaseRequest(@NotNull @Positive @Digits(integer = 7, fraction = 2) BigDecimal amount) {
}
