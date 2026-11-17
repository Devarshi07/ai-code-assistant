package com.debuggym.api.service;

import com.debuggym.api.model.Redemption;

/** A redemption plus whether it was replayed from an earlier request with the same key. */
public record RedemptionOutcome(Redemption redemption, boolean replayed) {
}
