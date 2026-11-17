package com.debuggym.api.repository;

import com.debuggym.api.model.Employee;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory employee store. Employees are never deleted.
 *
 * Every method that looks at records other than by id counts them in
 * {@link #recordsRead()}, so a test or a profiler can tell a lookup from a scan.
 * A manager-to-reports index answers "who reports to X" without scanning.
 */
@Repository
public class EmployeeRepository {
    private final Map<Long, Employee> employees = new ConcurrentHashMap<>();
    private final Map<Long, Set<Long>> reportIdsByManager = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final AtomicLong recordsRead = new AtomicLong();

    public long nextId() {
        return sequence.incrementAndGet();
    }

    /** Stores the employee and keeps the manager index in step when the manager changed. */
    public synchronized Employee save(Employee employee) {
        Employee previous = employees.put(employee.id(), employee);
        if (previous != null && previous.managerId() != null) {
            Set<Long> siblings = reportIdsByManager.get(previous.managerId());
            if (siblings != null) siblings.remove(employee.id());
        }
        if (employee.managerId() != null) {
            reportIdsByManager.computeIfAbsent(employee.managerId(), k -> ConcurrentHashMap.newKeySet()).add(employee.id());
        }
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

    /** The people who report directly to the given manager, ordered by id. Reads only those records. */
    public List<Employee> findByManagerId(long managerId) {
        List<Employee> reports = reportIdsByManager.getOrDefault(managerId, Set.of()).stream()
                .map(employees::get)
                .sorted(Comparator.comparingLong(Employee::id))
                .toList();
        recordsRead.addAndGet(reports.size());
        return reports;
    }

    /** How many employee records the scanning methods have looked at since the last reset. */
    public long recordsRead() {
        return recordsRead.get();
    }

    public void resetRecordsRead() {
        recordsRead.set(0);
    }
}
