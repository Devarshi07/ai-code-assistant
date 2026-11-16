package com.debuggym.api.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.locks.ReentrantLock;

/**
 * A customer account. The balance is stored with exactly two decimal places.
 * Hold lock() while reading and changing the balance; when two accounts are
 * involved, lock them in id order so two opposite transfers cannot deadlock.
 */
public class Account {
    private final String id;
    private final String owner;
    private final AccountType type;
    private final Instant openedAt;
    private final ReentrantLock lock = new ReentrantLock();
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
    public ReentrantLock lock() { return lock; }

    public BigDecimal getBalance() {
        lock.lock();
        try {
            return balance;
        } finally {
            lock.unlock();
        }
    }

    public void setBalance(BigDecimal balance) {
        if (!lock.isHeldByCurrentThread()) throw new IllegalStateException("Lock the account before changing its balance");
        this.balance = balance;
    }
}
