package com.debuggym.api.service;

import com.debuggym.api.dto.OpenAccountRequest;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.exception.AccountNotFoundException;
import com.debuggym.api.exception.InsufficientFundsException;
import com.debuggym.api.model.Account;
import com.debuggym.api.model.Transaction;
import com.debuggym.api.model.TransactionType;
import com.debuggym.api.repository.AccountRepository;
import com.debuggym.api.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;

@Service
public class AccountService {
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
        BigDecimal next = account.getBalance().add(value);
        account.setBalance(next);
        transactions.append(id, TransactionType.DEPOSIT, value, next, null);
        return account;
    }

    public Account withdraw(String id, BigDecimal amount) {
        Account account = get(id);
        BigDecimal value = Money.normalize(amount);
        BigDecimal next = account.getBalance().subtract(value);
        if (next.signum() < 0) throw new InsufficientFundsException(id);
        account.setBalance(next);
        transactions.append(id, TransactionType.WITHDRAWAL, value, next, null);
        return account;
    }

    /** One page of the account's ledger, newest entry first. Pages are numbered from 0. */
    public PageResponse<Transaction> history(String id, int page, int size) {
        throw new UnsupportedOperationException("Not implemented: transaction history (phase 2)");
    }
}
