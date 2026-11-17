package com.debuggym.api.service;

import com.debuggym.api.model.Employee;
import com.debuggym.api.repository.EmployeeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/** Reporting lines: direct and indirect reports, the management chain, and changing someone's manager. */
@Service
public class OrgChartService {
    private final EmployeeRepository repository;

    public OrgChartService(EmployeeRepository repository) {
        this.repository = repository;
    }

    /** The people who report directly to this employee, sorted by {@link Employee#BY_NAME}. */
    public List<Employee> directReports(long id) {
        throw new UnsupportedOperationException("Phase 2: list the direct reports of employee " + id);
    }

    /** Everyone below this employee at any depth, sorted by {@link Employee#BY_NAME}. */
    public List<Employee> allReports(long id) {
        throw new UnsupportedOperationException("Phase 2: list everyone under employee " + id);
    }

    /** The management chain: this employee's manager, then that manager's manager, up to the top. */
    public List<Employee> chain(long id) {
        throw new UnsupportedOperationException("Phase 2: build the management chain of employee " + id);
    }

    /** Sets the employee's manager (null clears it) and returns the updated employee. */
    public Employee assignManager(long id, Long managerId) {
        throw new UnsupportedOperationException("Phase 2: assign a manager to employee " + id);
    }
}
