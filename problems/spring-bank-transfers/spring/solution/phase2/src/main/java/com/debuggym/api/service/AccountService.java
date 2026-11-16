package com.debuggym.api.service;

import com.debuggym.api.dto.OpenAccountRequest;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.exception.AccountNotFoundException;
import com.debuggym.api.exception.InsufficientFundsException;
import com.debuggym.api.exception.ValidationFailedException;
import com.debuggym.api.model.Account;
import com.debuggym.api.model.Transaction;
import com.debuggym.api.model.TransactionType;
import com.debuggym.api.repository.AccountRepository;
import com.debuggym.api.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AccountService {
    public static final int MAX_PAGE_SIZE = 100;

    private final AccountRepository accounts;
    private final TransactionRepository transactions;

    public AccountService(AccountRepository accounts, TransactionRepository transactions) {
        this.accounts = accounts;
        this.transactions = transactions;
    }

    public Account open(OpenAccountRequest request) {
        BigDecimal opening = Money.normalize(request.openingBalance());
        Account account = accounts.save(new Account(accounts.nextId(), request.owner().trim(), request.type(), opening, Instant.now()));
        if (opening.signum() > 0) transactions.append(account.getId(), TransactionType.DEPOSIT, opening, opening, null);
        return account;
    }

    public Account get(String id) {
        return accounts.findById(id).orElseThrow(() -> new AccountNotFoundException(id));
    }

    public Account deposit(String id, BigDecimal amount) {
        Account account = get(id);
        BigDecimal value = Money.normalize(amount);
        BigDecimal next = credit(account, value);
        transactions.append(id, TransactionType.DEPOSIT, value, next, null);
        return account;
    }

    public Account withdraw(String id, BigDecimal amount) {
        Account account = get(id);
        BigDecimal value = Money.normalize(amount);
        BigDecimal next = debit(account, value);
        transactions.append(id, TransactionType.WITHDRAWAL, value, next, null);
        return account;
    }

    /** Takes money out if the account type's overdraft allows it, and returns the new balance. */
    public BigDecimal debit(Account account, BigDecimal value) {
        BigDecimal next = account.getBalance().subtract(value);
        if (next.compareTo(account.getType().overdraftLimit().negate()) < 0) throw new InsufficientFundsException(account.getId());
        account.setBalance(next);
        return next;
    }

    /** Adds money and returns the new balance. */
    public BigDecimal credit(Account account, BigDecimal value) {
        BigDecimal next = account.getBalance().add(value);
        account.setBalance(next);
        return next;
    }

    /** One page of the account's ledger, newest entry first. Pages are numbered from 0. */
    public PageResponse<Transaction> history(String id, int page, int size) {
        get(id);
        Map<String, String> problems = new LinkedHashMap<>();
        if (page < 0) problems.put("page", "must be 0 or more");
        if (size < 1 || size > MAX_PAGE_SIZE) problems.put("size", "must be between 1 and " + MAX_PAGE_SIZE);
        if (!problems.isEmpty()) throw new ValidationFailedException(problems);

        List<Transaction> ledger = transactions.findByAccount(id);
        int total = ledger.size();
        int totalPages = (total + size - 1) / size;
        long first = (long) page * size;
        long last = Math.min(total, first + size);
        List<Transaction> items = new ArrayList<>();
        for (long i = first; i < last; i++) items.add(ledger.get(total - 1 - (int) i));
        return new PageResponse<>(items, page, size, total, totalPages);
    }
}
