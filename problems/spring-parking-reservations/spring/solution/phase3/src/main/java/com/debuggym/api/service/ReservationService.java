package com.debuggym.api.service;

import com.debuggym.api.dto.ReservationRequest;
import com.debuggym.api.exception.ApiException;
import com.debuggym.api.exception.NotFoundException;
import com.debuggym.api.exception.ValidationFailedException;
import com.debuggym.api.model.Reservation;
import com.debuggym.api.model.Space;
import com.debuggym.api.repository.ReservationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
public class ReservationService {
    /** A reservation can be cancelled until this long before it starts. */
    public static final Duration CANCELLATION_CUTOFF = Duration.ofMinutes(30);

    private final SpaceService spaces;
    private final ReservationRepository reservations;
    private final Clock clock;

    public ReservationService(SpaceService spaces, ReservationRepository reservations, Clock clock) {
        this.spaces = spaces;
        this.reservations = reservations;
        this.clock = clock;
    }

    /** Books a space. synchronized: the overlap check and the save must not interleave. */
    public synchronized Reservation reserve(ReservationRequest request) {
        Windows.check(request.start(), request.end());
        Instant now = clock.instant();
        if (request.start().isBefore(now.minus(Duration.ofMinutes(1))))
            throw new ValidationFailedException("start", "must not be in the past");
        Space space = spaces.get(request.spaceId());
        if (!request.vehicleSize().fitsIn(space.size()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "space_too_small", "A " + request.vehicleSize() + " vehicle does not fit space " + space.label());
        if (!reservations.isFree(space.id(), request.start(), request.end()))
            throw new ApiException(HttpStatus.CONFLICT, "space_unavailable", "Space " + space.label() + " is already booked for part of that time");

        String plate = request.plate().trim().toUpperCase(Locale.ROOT);
        return reservations.save(new Reservation(reservations.nextId(), space.id(), plate, request.vehicleSize(), request.start(), request.end(), now));
    }

    public Reservation get(long id) {
        return reservations.findById(id).orElseThrow(() -> new NotFoundException("reservation_not_found", "No reservation with id " + id));
    }

    /** Cancels a reservation, following the rules in the README. Saving it again removes it from the index. */
    public synchronized Reservation cancel(long id) {
        Reservation reservation = get(id);
        if (!reservation.isActive())
            throw new ApiException(HttpStatus.CONFLICT, "already_cancelled", "Reservation " + id + " is already cancelled");
        Instant now = clock.instant();
        if (now.isAfter(reservation.getStart().minus(CANCELLATION_CUTOFF)))
            throw new ApiException(HttpStatus.CONFLICT, "cancellation_closed",
                    "Reservations can be cancelled until " + CANCELLATION_CUTOFF.toMinutes() + " minutes before they start");
        reservation.cancel(now);
        return reservations.save(reservation);
    }
}
