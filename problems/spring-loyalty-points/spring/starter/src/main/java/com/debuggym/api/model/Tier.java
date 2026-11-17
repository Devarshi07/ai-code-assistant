package com.debuggym.api.model;

import java.math.BigDecimal;

/** Membership tiers. A higher tier earns more points per currency unit spent. */
public enum Tier {
    BRONZE("1.00"),
    SILVER("1.25"),
    GOLD("1.50");

    private final BigDecimal pointsPerUnit;

    Tier(String pointsPerUnit) {
        this.pointsPerUnit = new BigDecimal(pointsPerUnit);
    }

    public BigDecimal pointsPerUnit() {
        return pointsPerUnit;
    }
}
