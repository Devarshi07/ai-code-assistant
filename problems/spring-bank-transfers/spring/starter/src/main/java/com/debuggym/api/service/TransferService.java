package com.debuggym.api.service;

import com.debuggym.api.dto.TransferRequest;
import com.debuggym.api.model.Transfer;
import com.debuggym.api.repository.TransactionRepository;
import com.debuggym.api.repository.TransferRepository;
import org.springframework.stereotype.Service;

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
        throw new UnsupportedOperationException("Not implemented: transfers (phase 2)");
    }
}
