package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

/** A 404 for a member or a reward that does not exist. */
public class NotFoundException extends ApiException {
    private NotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }

    public static NotFoundException member(String id) {
        return new NotFoundException("member_not_found", "No member with id " + id);
    }

    public static NotFoundException reward(String id) {
        return new NotFoundException("reward_not_found", "No reward with id " + id);
    }
}
