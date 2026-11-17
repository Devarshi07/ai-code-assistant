package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/** A 400 for rules that @Valid cannot express, such as query parameters and email format. */
public class ValidationFailedException extends ApiException {
    public ValidationFailedException(Map<String, String> fields) {
        super(HttpStatus.BAD_REQUEST, "validation_error", "The request is not valid", fields);
    }

    public ValidationFailedException(String field, String problem) {
        this(Map.of(field, problem));
    }
}
