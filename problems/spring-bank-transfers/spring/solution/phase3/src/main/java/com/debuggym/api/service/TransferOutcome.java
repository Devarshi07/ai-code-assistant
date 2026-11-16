package com.debuggym.api.service;

import com.debuggym.api.model.Transfer;

/** A transfer, and whether it was replayed for a repeated Idempotency-Key. */
public record TransferOutcome(Transfer transfer, boolean replayed) {
}
