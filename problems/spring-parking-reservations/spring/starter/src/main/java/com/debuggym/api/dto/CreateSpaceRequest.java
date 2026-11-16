package com.debuggym.api.dto;

import com.debuggym.api.model.VehicleSize;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSpaceRequest(
        @NotBlank @Size(max = 12) String label,
        @NotNull @Min(-5) @Max(20) Integer level,
        @NotNull VehicleSize size) {
}
