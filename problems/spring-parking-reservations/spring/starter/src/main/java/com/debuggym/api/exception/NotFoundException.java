package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

/** A 404 with a specific code, such as space_not_found. */
public class NotFoundException extends ApiException {
    public NotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }
}
