package com.debuggym.api.repository;

import com.debuggym.api.model.Employee;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory employee store. Employees are never deleted.
 *
 * Every method that looks at records other than by id counts them in
 * {@link #recordsRead()}, so a test or a profiler can tell a lookup from a scan.
 */
@Repository
public class EmployeeRepository {
    private final Map<Long, Employee> employees = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final AtomicLong recordsRead = new AtomicLong();

    public long nextId() {
        return sequence.incrementAndGet();
    }

    public Employee save(Employee employee) {
        employees.put(employee.id(), employee);
        return employee;
    }

    /** A direct lookup by id; not counted as a scan. */
    public Optional<Employee> findById(long id) {
        return Optional.ofNullable(employees.get(id));
    }

    /** Everyone, ordered by id. Reads every record. */
    public List<Employee> findAll() {
        recordsRead.addAndGet(employees.size());
        return employees.values().stream().sorted(Comparator.comparingLong(Employee::id)).toList();
    }

    /** The people who report directly to the given manager, ordered by id. Reads every record. */
    public List<Employee> findByManagerId(long managerId) {
        recordsRead.addAndGet(employees.size());
        return employees.values().stream()
                .filter(e -> e.managerId() != null && e.managerId() == managerId)
                .sorted(Comparator.comparingLong(Employee::id))
                .toList();
    }

    /** How many employee records the scanning methods have looked at since the last reset. */
    public long recordsRead() {
        return recordsRead.get();
    }

    public void resetRecordsRead() {
        recordsRead.set(0);
    }
}
