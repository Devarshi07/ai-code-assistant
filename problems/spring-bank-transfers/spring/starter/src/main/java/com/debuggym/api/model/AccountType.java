package com.debuggym.api.model;

import java.math.BigDecimal;

/** The account products Ledgerline sells. */
public enum AccountType {
    SAVINGS("0.00"),
    CHECKING("500.00"),
    BUSINESS("5000.00");

    private final BigDecimal overdraftLimit;

    AccountType(String overdraftLimit) {
        this.overdraftLimit = new BigDecimal(overdraftLimit);
    }

    /** How far below zero the balance of this kind of account may go. */
    public BigDecimal overdraftLimit() {
        return overdraftLimit;
    }
}
