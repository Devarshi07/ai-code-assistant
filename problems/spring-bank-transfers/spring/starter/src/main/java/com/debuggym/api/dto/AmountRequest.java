package com.debuggym.api.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** The body of a deposit or a withdrawal. */
public record AmountRequest(@NotNull @Positive @Digits(integer = 12, fraction = 2) BigDecimal amount) {
}
