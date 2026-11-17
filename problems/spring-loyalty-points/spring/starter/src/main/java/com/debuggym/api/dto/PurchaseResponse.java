package com.debuggym.api.dto;

import java.time.LocalDate;

/** lotId and expiresOn are null when the purchase was too small to earn a point. */
public record PurchaseResponse(int pointsEarned, int balance, String lotId, LocalDate expiresOn) {
}
