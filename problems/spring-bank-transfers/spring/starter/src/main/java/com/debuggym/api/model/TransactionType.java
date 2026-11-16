package com.debuggym.api.model;

/** The kinds of ledger entry. Amounts are always positive; the type gives the direction. */
public enum TransactionType {
    DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
}
