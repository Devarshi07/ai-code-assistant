package com.debuggym.api.dto;

import com.debuggym.api.model.AccountType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OpenAccountRequest(
        @NotBlank @Size(max = 80) String owner,
        @NotNull AccountType type,
        @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal openingBalance) {
}
