package com.debuggym.api.dto;

import com.debuggym.api.model.Employee;

public record EmployeeResponse(long id, String name, String email, String department, String title, Long managerId) {
    public static EmployeeResponse from(Employee e) {
        return new EmployeeResponse(e.id(), e.name(), e.email(), e.department(), e.title(), e.managerId());
    }
}
