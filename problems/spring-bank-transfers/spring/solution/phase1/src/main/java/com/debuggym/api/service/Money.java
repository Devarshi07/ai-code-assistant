package com.debuggym.api.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Money rules shared by the services and the API responses. */
public final class Money {
    public static final int SCALE = 2;

    private Money() {
    }

    /**
     * Stored amounts always have two decimal places. Request validation already
     * rejects amounts with more than two, so nothing is ever rounded here.
     */
    public static BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.UNNECESSARY);
    }

    /**
     * How an amount appears in API responses: always two decimals, never
     * scientific notation ("100.00", "250.50", "-12.30").
     */
    public static String format(BigDecimal value) {
        return normalize(value).toPlainString();
    }
}
