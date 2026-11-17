package com.debuggym.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/** Spend points on a reward. quantity is optional and defaults to 1. */
public record RedeemRequest(@NotBlank String rewardId, @Min(1) @Max(10) Integer quantity) {
    public int quantityOrOne() {
        return quantity == null ? 1 : quantity;
    }
}
