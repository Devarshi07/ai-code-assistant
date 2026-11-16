package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Base class for errors that belong in the API contract. ApiExceptionHandler
 * turns each one into its status and {"error": {"code", "message", "fields"}}.
 */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fields;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, String> fields) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public Map<String, String> getFields() { return fields; }
}
