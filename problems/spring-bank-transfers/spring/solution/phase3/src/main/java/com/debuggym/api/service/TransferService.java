package com.debuggym.api.service;

import com.debuggym.api.dto.TransferRequest;
import com.debuggym.api.exception.ApiException;
import com.debuggym.api.exception.ValidationFailedException;
import com.debuggym.api.model.Account;
import com.debuggym.api.model.Transfer;
import com.debuggym.api.model.TransactionType;
import com.debuggym.api.repository.TransactionRepository;
import com.debuggym.api.repository.TransferRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.regex.Pattern;

@Service
public class TransferService {
    private static final Pattern KEY = Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private final AccountService accounts;
    private final TransferRepository transfers;
    private final TransactionRepository transactions;
    private final IdempotencyStore idempotency;

    public TransferService(AccountService accounts, TransferRepository transfers, TransactionRepository transactions, IdempotencyStore idempotency) {
        this.accounts = accounts;
        this.transfers = transfers;
        this.transactions = transactions;
        this.idempotency = idempotency;
    }

    /** Runs the transfer once per Idempotency-Key; without a key every call is a new transfer. */
    public TransferOutcome transfer(TransferRequest request, String idempotencyKey) {
        if (idempotencyKey == null) return new TransferOutcome(execute(request), false);
        if (!KEY.matcher(idempotencyKey).matches())
            throw new ValidationFailedException("Idempotency-Key", "must be 1 to 64 letters, digits, '-' or '_'");
        return idempotency.run(idempotencyKey, fingerprint(request), () -> execute(request));
    }

    private static String fingerprint(TransferRequest request) {
        return String.join("|", request.fromAccountId(), request.toAccountId(), Money.normalize(request.amount()).toPlainString(),
                request.memo() == null ? "" : request.memo());
    }

    /** Moves money between two accounts and records both sides, holding both locks in id order. */
    private Transfer execute(TransferRequest request) {
        if (request.fromAccountId().equals(request.toAccountId()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "same_account", "A transfer needs two different accounts");
        Account from = accounts.get(request.fromAccountId());
        Account to = accounts.get(request.toAccountId());
        BigDecimal amount = Money.normalize(request.amount());

        Account first = from.getId().compareTo(to.getId()) < 0 ? from : to;
        Account second = first == from ? to : from;
        first.lock().lock();
        try {
            second.lock().lock();
            try {
                String id = transfers.nextId();
                BigDecimal fromAfter = accounts.debit(from, amount);
                BigDecimal toAfter = accounts.credit(to, amount);
                transactions.append(from.getId(), TransactionType.TRANSFER_OUT, amount, fromAfter, id);
                transactions.append(to.getId(), TransactionType.TRANSFER_IN, amount, toAfter, id);
                return transfers.save(new Transfer(id, from.getId(), to.getId(), amount, request.memo(), Instant.now()));
            } finally {
                second.lock().unlock();
            }
        } finally {
            first.lock().unlock();
        }
    }
}
