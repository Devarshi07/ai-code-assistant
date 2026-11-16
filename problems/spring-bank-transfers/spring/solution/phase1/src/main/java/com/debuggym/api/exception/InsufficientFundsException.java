package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a debit would take an account past what it is allowed to spend. */
public class InsufficientFundsException extends ApiException {
    public InsufficientFundsException(String accountId) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, "insufficient_funds", "Account " + accountId + " does not have enough funds for this payment");
    }
}
