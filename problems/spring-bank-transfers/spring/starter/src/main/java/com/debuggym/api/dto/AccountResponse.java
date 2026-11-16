package com.debuggym.api.dto;

import com.debuggym.api.model.Account;
import com.debuggym.api.model.AccountType;
import com.debuggym.api.service.Money;

/** Money goes out as a string ("120.50"), so no client parses it into a float. */
public record AccountResponse(String id, String owner, AccountType type, String balance) {
    public static AccountResponse from(Account account) {
        return new AccountResponse(account.getId(), account.getOwner(), account.getType(), Money.format(account.getBalance()));
    }
}
