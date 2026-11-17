package com.debuggym.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** managerId is optional: leave it out for someone at the top of the org chart. */
public record CreateEmployeeRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 120) String email,
        @NotBlank @Size(max = 60) String department,
        @NotBlank @Size(max = 80) String title,
        @Positive Long managerId) {
}
