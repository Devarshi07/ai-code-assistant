package com.debuggym.api.dto;

import com.debuggym.api.model.VehicleSize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;

public record ReservationRequest(
        @NotNull Long spaceId,
        @NotNull @Pattern(regexp = "[A-Za-z0-9 -]{2,10}", message = "must be 2 to 10 letters, digits, spaces or dashes") String plate,
        @NotNull VehicleSize vehicleSize,
        @NotNull Instant start,
        @NotNull Instant end) {
}
