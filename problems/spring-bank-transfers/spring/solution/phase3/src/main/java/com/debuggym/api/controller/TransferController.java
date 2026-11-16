package com.debuggym.api.controller;

import com.debuggym.api.dto.TransferRequest;
import com.debuggym.api.dto.TransferResponse;
import com.debuggym.api.model.Transfer;
import com.debuggym.api.service.TransferOutcome;
import com.debuggym.api.service.TransferService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/transfers")
public class TransferController {
    private final TransferService service;

    public TransferController(TransferService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<TransferResponse> create(@Valid @RequestBody TransferRequest request,
                                                   @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
        TransferOutcome outcome = service.transfer(request, idempotencyKey);
        Transfer transfer = outcome.transfer();
        return ResponseEntity.created(URI.create("/transfers/" + transfer.id()))
                .header("Idempotent-Replayed", String.valueOf(outcome.replayed()))
                .body(TransferResponse.from(transfer));
    }
}
