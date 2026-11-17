package com.debuggym.api.service;

import com.debuggym.api.exception.ValidationFailedException;

import java.util.regex.Pattern;

/** A deliberately simple email check: something@domain.tld with no spaces. */
final class Emails {
    private static final Pattern SHAPE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private Emails() {
    }

    /** Returns the email unchanged when it is well formed. */
    static String requireValid(String email) {
        if (!SHAPE.matcher(email).matches()) {
            throw new ValidationFailedException("email", "must be a well-formed email address");
        }
        return email;
    }
}
