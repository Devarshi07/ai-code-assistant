package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

public class AccountNotFoundException extends ApiException {
    public AccountNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "account_not_found", "No account with id " + id);
    }
}
