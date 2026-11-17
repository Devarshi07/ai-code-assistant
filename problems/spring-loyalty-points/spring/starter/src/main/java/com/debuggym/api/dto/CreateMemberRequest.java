package com.debuggym.api.dto;

import com.debuggym.api.model.Tier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateMemberRequest(@NotBlank @Size(max = 80) String name, @NotNull Tier tier) {
}
