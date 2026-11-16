package com.debuggym.api.model;

import java.math.BigDecimal;
import java.time.Instant;

/** A customer account. The balance is stored with exactly two decimal places. */
public class Account {
    private final String id;
    private final String owner;
    private final AccountType type;
    private final Instant openedAt;
    private BigDecimal balance;

    public Account(String id, String owner, AccountType type, BigDecimal balance, Instant openedAt) {
        this.id = id;
        this.owner = owner;
        this.type = type;
        this.balance = balance;
        this.openedAt = openedAt;
    }

    public String getId() { return id; }
    public String getOwner() { return owner; }
    public AccountType getType() { return type; }
    public Instant getOpenedAt() { return openedAt; }
    public BigDecimal getBalance() { return balance; }

    public void setBalance(BigDecimal balance) { this.balance = balance; }
}
