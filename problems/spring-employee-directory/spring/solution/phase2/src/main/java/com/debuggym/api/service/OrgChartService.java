package com.debuggym.api.service;

import com.debuggym.api.exception.EmployeeNotFoundException;
import com.debuggym.api.exception.ManagerCycleException;
import com.debuggym.api.model.Employee;
import com.debuggym.api.repository.EmployeeRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/** Reporting lines: direct and indirect reports, the management chain, and changing someone's manager. */
@Service
public class OrgChartService {
    private final EmployeeRepository repository;

    public OrgChartService(EmployeeRepository repository) {
        this.repository = repository;
    }

    private Employee require(long id) {
        return repository.findById(id).orElseThrow(() -> new EmployeeNotFoundException(id));
    }

    /** The people who report directly to this employee, sorted by {@link Employee#BY_NAME}. */
    public List<Employee> directReports(long id) {
        require(id);
        return repository.findByManagerId(id).stream().sorted(Employee.BY_NAME).toList();
    }

    /** Everyone below this employee at any depth, sorted by {@link Employee#BY_NAME}. */
    public List<Employee> allReports(long id) {
        require(id);
        List<Employee> found = new ArrayList<>();
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(id);
        while (!queue.isEmpty()) {
            for (Employee report : repository.findByManagerId(queue.poll())) {
                found.add(report);
                queue.add(report.id());
            }
        }
        found.sort(Employee.BY_NAME);
        return found;
    }

    /** The management chain: this employee's manager, then that manager's manager, up to the top. */
    public List<Employee> chain(long id) {
        List<Employee> chain = new ArrayList<>();
        Long next = require(id).managerId();
        while (next != null) {
            Employee manager = require(next);
            chain.add(manager);
            next = manager.managerId();
        }
        return chain;
    }

    /** Sets the employee's manager (null clears it) and returns the updated employee. */
    public Employee assignManager(long id, Long managerId) {
        Employee employee = require(id);
        if (managerId != null) {
            // Walk up from the proposed manager: meeting the employee on the way means a loop.
            for (Employee up = require(managerId); up != null; up = up.managerId() == null ? null : require(up.managerId())) {
                if (up.id() == id) throw new ManagerCycleException(id, managerId);
            }
        }
        return repository.save(employee.withManager(managerId));
    }
}
