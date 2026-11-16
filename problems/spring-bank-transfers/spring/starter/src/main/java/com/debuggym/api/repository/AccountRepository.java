package com.debuggym.api.repository;

import com.debuggym.api.model.Account;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory account store. Accounts are never deleted. */
@Repository
public class AccountRepository {
    private final Map<String, Account> accounts = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public String nextId() {
        return "acc_" + sequence.incrementAndGet();
    }

    public Account save(Account account) {
        accounts.put(account.getId(), account);
        return account;
    }

    public Optional<Account> findById(String id) {
        return Optional.ofNullable(accounts.get(id));
    }
}
