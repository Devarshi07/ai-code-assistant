package com.debuggym.api.service;

import com.debuggym.api.dto.TransferRequest;
import com.debuggym.api.exception.ApiException;
import com.debuggym.api.model.Account;
import com.debuggym.api.model.Transfer;
import com.debuggym.api.model.TransactionType;
import com.debuggym.api.repository.TransactionRepository;
import com.debuggym.api.repository.TransferRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;

@Service
public class TransferService {
    private final AccountService accounts;
    private final TransferRepository transfers;
    private final TransactionRepository transactions;

    public TransferService(AccountService accounts, TransferRepository transfers, TransactionRepository transactions) {
        this.accounts = accounts;
        this.transfers = transfers;
        this.transactions = transactions;
    }

    /** Moves money between two accounts and records both sides in their ledgers. */
    public Transfer transfer(TransferRequest request) {
        if (request.fromAccountId().equals(request.toAccountId()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "same_account", "A transfer needs two different accounts");
        Account from = accounts.get(request.fromAccountId());
        Account to = accounts.get(request.toAccountId());
        BigDecimal amount = Money.normalize(request.amount());

        String id = transfers.nextId();
        BigDecimal fromAfter = accounts.debit(from, amount);
        BigDecimal toAfter = accounts.credit(to, amount);
        transactions.append(from.getId(), TransactionType.TRANSFER_OUT, amount, fromAfter, id);
        transactions.append(to.getId(), TransactionType.TRANSFER_IN, amount, toAfter, id);
        return transfers.save(new Transfer(id, from.getId(), to.getId(), amount, request.memo(), Instant.now()));
    }
}
