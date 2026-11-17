package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

/** A 409: the requested manager already reports, directly or not, to the employee. */
public class ManagerCycleException extends ApiException {
    public ManagerCycleException(long employeeId, long managerId) {
        super(HttpStatus.CONFLICT, "manager_cycle",
                "Employee " + managerId + " cannot manage employee " + employeeId + ": that would create a reporting cycle");
    }
}
