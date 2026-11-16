package com.debuggym.api.exception;

/** Thrown when a debit would take an account past what it is allowed to spend. */
public class InsufficientFundsException extends RuntimeException {
    public InsufficientFundsException(String accountId) {
        super("Account " + accountId + " does not have enough funds for this payment");
    }
}
