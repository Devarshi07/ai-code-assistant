package com.debuggym.api.model;

import java.time.Instant;

/**
 * A booking of one space for the window [start, end). The window is half-open:
 * a reservation that ends at 10:00 and one that starts at 10:00 do not share
 * any time. After changing a reservation, save it again through the repository.
 */
public class Reservation {
    private final long id;
    private final long spaceId;
    private final String plate;
    private final VehicleSize vehicleSize;
    private final Instant start;
    private final Instant end;
    private final Instant createdAt;
    private ReservationStatus status = ReservationStatus.ACTIVE;
    private Instant cancelledAt;

    public Reservation(long id, long spaceId, String plate, VehicleSize vehicleSize, Instant start, Instant end, Instant createdAt) {
        this.id = id;
        this.spaceId = spaceId;
        this.plate = plate;
        this.vehicleSize = vehicleSize;
        this.start = start;
        this.end = end;
        this.createdAt = createdAt;
    }

    public long getId() { return id; }
    public long getSpaceId() { return spaceId; }
    public String getPlate() { return plate; }
    public VehicleSize getVehicleSize() { return vehicleSize; }
    public Instant getStart() { return start; }
    public Instant getEnd() { return end; }
    public Instant getCreatedAt() { return createdAt; }
    public ReservationStatus getStatus() { return status; }
    public Instant getCancelledAt() { return cancelledAt; }

    public boolean isActive() {
        return status == ReservationStatus.ACTIVE;
    }

    public void cancel(Instant at) {
        status = ReservationStatus.CANCELLED;
        cancelledAt = at;
    }

    /**
     * True when this reservation and the window [otherStart, otherEnd) share any
     * time. Both are half-open, so each must start strictly before the other ends.
     */
    public boolean overlaps(Instant otherStart, Instant otherEnd) {
        return otherStart.isBefore(end) && start.isBefore(otherEnd);
    }
}
