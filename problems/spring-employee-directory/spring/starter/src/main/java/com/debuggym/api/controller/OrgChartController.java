package com.debuggym.api.controller;

import com.debuggym.api.dto.AssignManagerRequest;
import com.debuggym.api.dto.EmployeeResponse;
import com.debuggym.api.service.OrgChartService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The org chart: who reports to whom. HTTP only; the rules live in OrgChartService. */
@RestController
@RequestMapping("/api/employees/{id}")
public class OrgChartController {
    private final OrgChartService service;

    public OrgChartController(OrgChartService service) {
        this.service = service;
    }

    @GetMapping("/reports")
    public List<EmployeeResponse> reports(@PathVariable("id") long id,
                                          @RequestParam(name = "all", defaultValue = "false") boolean all) {
        return (all ? service.allReports(id) : service.directReports(id)).stream().map(EmployeeResponse::from).toList();
    }

    @GetMapping("/chain")
    public List<EmployeeResponse> chain(@PathVariable("id") long id) {
        return service.chain(id).stream().map(EmployeeResponse::from).toList();
    }

    @PutMapping("/manager")
    public EmployeeResponse assignManager(@PathVariable("id") long id, @RequestBody AssignManagerRequest request) {
        return EmployeeResponse.from(service.assignManager(id, request.managerId()));
    }
}
