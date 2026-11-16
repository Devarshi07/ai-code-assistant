package com.debuggym.api.controller;

import com.debuggym.api.dto.AccountResponse;
import com.debuggym.api.dto.AmountRequest;
import com.debuggym.api.dto.OpenAccountRequest;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.dto.TransactionResponse;
import com.debuggym.api.model.Account;
import com.debuggym.api.service.AccountService;
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
@RequestMapping("/accounts")
public class AccountController {
    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<AccountResponse> open(@Valid @RequestBody OpenAccountRequest request) {
        Account account = service.open(request);
        return ResponseEntity.created(URI.create("/accounts/" + account.getId())).body(AccountResponse.from(account));
    }

    @GetMapping("/{id}")
    public AccountResponse get(@PathVariable("id") String id) {
        return AccountResponse.from(service.get(id));
    }

    @PostMapping("/{id}/deposits")
    public AccountResponse deposit(@PathVariable("id") String id, @Valid @RequestBody AmountRequest request) {
        return AccountResponse.from(service.deposit(id, request.amount()));
    }

    @PostMapping("/{id}/withdrawals")
    public AccountResponse withdraw(@PathVariable("id") String id, @Valid @RequestBody AmountRequest request) {
        return AccountResponse.from(service.withdraw(id, request.amount()));
    }

    @GetMapping("/{id}/transactions")
    public PageResponse<TransactionResponse> transactions(@PathVariable("id") String id,
                                                          @RequestParam(name = "page", defaultValue = "0") int page,
                                                          @RequestParam(name = "size", defaultValue = "20") int size) {
        return service.history(id, page, size).map(TransactionResponse::from);
    }
}
