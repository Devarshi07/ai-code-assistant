package com.debuggym.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a redemption costs more than the member's spendable points. */
public class InsufficientPointsException extends ApiException {
    public InsufficientPointsException(int balance, int cost) {
        super(HttpStatus.CONFLICT, "insufficient_points",
                "This reward costs " + cost + " points but only " + balance + " are available");
    }
}
