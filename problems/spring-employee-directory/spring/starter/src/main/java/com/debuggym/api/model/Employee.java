package com.debuggym.api.model;

import java.util.Comparator;

/**
 * One person in the directory. Employees are immutable: moving someone to a new
 * manager means saving a copy made with {@link #withManager(Long)}. A null
 * managerId means the person is at the top of the org chart.
 */
public record Employee(long id, String name, String email, String department, String title, Long managerId) {

    /** How the directory lists people: by name (ignoring case), then by id. */
    public static final Comparator<Employee> BY_NAME =
            Comparator.comparing(Employee::name, String.CASE_INSENSITIVE_ORDER).thenComparingLong(Employee::id);

    public Employee withManager(Long newManagerId) {
        return new Employee(id, name, email, department, title, newManagerId);
    }
}
