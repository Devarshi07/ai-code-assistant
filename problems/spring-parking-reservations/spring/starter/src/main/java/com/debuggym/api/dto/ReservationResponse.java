package com.debuggym.api.dto;

import com.debuggym.api.model.Reservation;
import com.debuggym.api.model.ReservationStatus;
import com.debuggym.api.model.VehicleSize;

import java.time.Instant;

public record ReservationResponse(long id, long spaceId, String plate, VehicleSize vehicleSize, Instant start, Instant end,
                                  ReservationStatus status, Instant createdAt, Instant cancelledAt) {
    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(r.getId(), r.getSpaceId(), r.getPlate(), r.getVehicleSize(), r.getStart(), r.getEnd(),
                r.getStatus(), r.getCreatedAt(), r.getCancelledAt());
    }
}
