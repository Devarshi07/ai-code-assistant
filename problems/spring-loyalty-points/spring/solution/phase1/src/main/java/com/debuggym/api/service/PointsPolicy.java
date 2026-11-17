package com.debuggym.api.service;

import com.debuggym.api.model.Tier;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/** The programme's earning and expiry rules, in one place. */
@Component
public class PointsPolicy {
    /** Points earned by one purchase: amount times the tier rate, rounded down per purchase. */
    public int pointsFor(Tier tier, BigDecimal amount) {
        BigDecimal exact = amount.multiply(tier.pointsPerUnit());
        return exact.setScale(0, RoundingMode.DOWN).intValueExact();
    }

    /** Points expire 12 months after the day they were earned. */
    public LocalDate expiryFor(LocalDate earnedOn) {
        return earnedOn.plusYears(1);
    }
}
