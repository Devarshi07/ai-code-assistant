package com.debuggym.api.controller;

import com.debuggym.api.dto.CreateEmployeeRequest;
import com.debuggym.api.dto.EmployeeResponse;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.model.Employee;
import com.debuggym.api.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
    private final EmployeeService service;

    public EmployeeController(EmployeeService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<EmployeeResponse> create(@Valid @RequestBody CreateEmployeeRequest request) {
        Employee employee = service.create(request);
        return ResponseEntity.created(URI.create("/api/employees/" + employee.id())).body(EmployeeResponse.from(employee));
    }

    @GetMapping("/{id}")
    public EmployeeResponse get(@PathVariable("id") long id) {
        return EmployeeResponse.from(service.get(id));
    }

    @GetMapping
    public PageResponse<EmployeeResponse> list(@RequestParam(name = "page", defaultValue = "1") int page,
                                               @RequestParam(name = "size", defaultValue = "20") int size,
                                               @RequestParam(name = "department", required = false) String department) {
        return service.list(page, size, department).map(EmployeeResponse::from);
    }
}
