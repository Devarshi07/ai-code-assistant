package com.debuggym.api.service;

import com.debuggym.api.dto.CreateEmployeeRequest;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.exception.EmployeeNotFoundException;
import com.debuggym.api.exception.ValidationFailedException;
import com.debuggym.api.model.Employee;
import com.debuggym.api.repository.EmployeeRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class EmployeeService {
    private final EmployeeRepository repository;

    public EmployeeService(EmployeeRepository repository) {
        this.repository = repository;
    }

    public Employee create(CreateEmployeeRequest request) {
        String email = Emails.requireValid(request.email().trim());
        if (request.managerId() != null && repository.findById(request.managerId()).isEmpty()) {
            throw new EmployeeNotFoundException(request.managerId());
        }
        Employee employee = new Employee(repository.nextId(), request.name().trim(), email,
                request.department().trim(), request.title().trim(), request.managerId());
        return repository.save(employee);
    }

    public Employee get(long id) {
        return repository.findById(id).orElseThrow(() -> new EmployeeNotFoundException(id));
    }

    /**
     * One page of the directory, ordered by id. page is 1-based. When department
     * is given, only people in that department are listed (ignoring case).
     */
    public PageResponse<Employee> list(int page, int size, String department) {
        Map<String, String> problems = new LinkedHashMap<>();
        if (page < 1) problems.put("page", "must be 1 or greater");
        if (size < 1 || size > 100) problems.put("size", "must be between 1 and 100");
        if (!problems.isEmpty()) throw new ValidationFailedException(problems);

        List<Employee> matching = repository.findAll().stream()
                .filter(e -> department == null || e.department().equalsIgnoreCase(department))
                .toList();
        int from = (int) Math.min((long) (page - 1) * size, matching.size());
        int to = Math.min(from + size, matching.size());
        int totalPages = (int) ((matching.size() + size - 1) / size);
        return new PageResponse<>(matching.subList(from, to), page, size, matching.size(), totalPages);
    }
}
