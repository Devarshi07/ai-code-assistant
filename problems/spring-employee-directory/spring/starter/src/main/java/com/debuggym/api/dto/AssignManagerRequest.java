package com.debuggym.api.dto;

/** A null managerId (or a missing one) takes the employee out from under their manager. */
public record AssignManagerRequest(Long managerId) {
}
