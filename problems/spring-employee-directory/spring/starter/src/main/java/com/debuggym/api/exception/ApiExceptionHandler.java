package com.debuggym.api.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Every error leaves the API as {"error": {"code": ..., "message": ..., "fields": {...}}}. */
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException e) {
        return error(e.getStatus(), e.getCode(), e.getMessage(), e.getFields());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> invalidBody(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError f : e.getBindingResult().getFieldErrors()) fields.putIfAbsent(f.getField(), f.getDefaultMessage());
        return error(HttpStatus.BAD_REQUEST, "validation_error", "The request is not valid", fields);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, Object>> invalidParameter(MethodArgumentTypeMismatchException e) {
        return error(HttpStatus.BAD_REQUEST, "validation_error", "The request is not valid", Map.of(e.getName(), "has the wrong type"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> unreadable(HttpMessageNotReadableException e) {
        return error(HttpStatus.BAD_REQUEST, "malformed_request", "The request body is not valid JSON for this endpoint", Map.of());
    }

    @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class, HttpMediaTypeNotSupportedException.class})
    ResponseEntity<Map<String, Object>> routing(Exception e) {
        HttpStatusCode status = ((ErrorResponse) e).getStatusCode();
        return error(status, status.value() == 404 ? "not_found" : "request_error", e.getMessage(), Map.of());
    }

    @ExceptionHandler(UnsupportedOperationException.class)
    ResponseEntity<Map<String, Object>> notImplemented(UnsupportedOperationException e) {
        return error(HttpStatus.NOT_IMPLEMENTED, "not_implemented", e.getMessage(), Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception e) {
        log.error("Unhandled error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", "Something went wrong", Map.of());
    }

    static ResponseEntity<Map<String, Object>> error(HttpStatusCode status, String code, String message, Map<String, String> fields) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        if (!fields.isEmpty()) body.put("fields", fields);
        return ResponseEntity.status(status).body(Map.of("error", body));
    }
}
