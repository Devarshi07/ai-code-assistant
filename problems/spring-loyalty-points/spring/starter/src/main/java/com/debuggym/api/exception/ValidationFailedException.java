package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/** A 422 for rules that @Valid cannot express, such as query parameters. */
public class ValidationFailedException extends ApiException {
    public ValidationFailedException(Map<String, String> fields) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, "validation_error", "The request is not valid", fields);
    }

    public ValidationFailedException(String field, String problem) {
        this(Map.of(field, problem));
    }
}
