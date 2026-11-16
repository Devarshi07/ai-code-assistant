package com.debuggym.api.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record TransferRequest(
        @NotBlank String fromAccountId,
        @NotBlank String toAccountId,
        @NotNull @Positive @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @Size(max = 140) String memo) {
}
