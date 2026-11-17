package com.debuggym.api.controller;

import com.debuggym.api.dto.CreateMemberRequest;
import com.debuggym.api.dto.MemberResponse;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.dto.PurchaseRequest;
import com.debuggym.api.dto.PurchaseResponse;
import com.debuggym.api.dto.StatementEntryResponse;
import com.debuggym.api.model.Member;
import com.debuggym.api.service.PointsService;
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
import java.util.List;

@RestController
@RequestMapping("/members")
public class MemberController {
    private final PointsService service;

    public MemberController(PointsService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<MemberResponse> create(@Valid @RequestBody CreateMemberRequest request) {
        Member member = service.createMember(request);
        return ResponseEntity.created(URI.create("/members/" + member.getId())).body(MemberResponse.from(member, List.of()));
    }

    @GetMapping("/{id}")
    public MemberResponse get(@PathVariable("id") String id) {
        return service.describe(id);
    }

    @PostMapping("/{id}/purchases")
    public ResponseEntity<PurchaseResponse> purchase(@PathVariable("id") String id, @Valid @RequestBody PurchaseRequest request) {
        return ResponseEntity.status(201).body(service.earn(id, request.amount()));
    }

    @GetMapping("/{id}/statement")
    public PageResponse<StatementEntryResponse> statement(@PathVariable("id") String id,
                                                          @RequestParam(name = "page", defaultValue = "0") int page,
                                                          @RequestParam(name = "size", defaultValue = "20") int size) {
        return service.statement(id, page, size).map(StatementEntryResponse::from);
    }
}
