package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

public class EmployeeNotFoundException extends ApiException {
    public EmployeeNotFoundException(long id) {
        super(HttpStatus.NOT_FOUND, "employee_not_found", "No employee with id " + id);
    }
}
