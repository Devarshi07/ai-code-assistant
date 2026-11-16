package com.debuggym.api.controller;

import com.debuggym.api.dto.AvailabilityResponse;
import com.debuggym.api.dto.ReservationRequest;
import com.debuggym.api.dto.ReservationResponse;
import com.debuggym.api.model.Reservation;
import com.debuggym.api.model.VehicleSize;
import com.debuggym.api.service.AvailabilityService;
import com.debuggym.api.service.ReservationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Instant;

@RestController
public class ReservationController {
    private final ReservationService reservations;
    private final AvailabilityService availability;

    public ReservationController(ReservationService reservations, AvailabilityService availability) {
        this.reservations = reservations;
        this.availability = availability;
    }

    @PostMapping("/reservations")
    public ResponseEntity<ReservationResponse> reserve(@Valid @RequestBody ReservationRequest request) {
        Reservation reservation = reservations.reserve(request);
        return ResponseEntity.created(URI.create("/reservations/" + reservation.getId())).body(ReservationResponse.from(reservation));
    }

    @GetMapping("/reservations/{id}")
    public ReservationResponse get(@PathVariable("id") long id) {
        return ReservationResponse.from(reservations.get(id));
    }

    @PostMapping("/reservations/{id}/cancel")
    public ReservationResponse cancel(@PathVariable("id") long id) {
        return ReservationResponse.from(reservations.cancel(id));
    }

    @GetMapping("/availability")
    public AvailabilityResponse search(@RequestParam("start") Instant start, @RequestParam("end") Instant end,
                                       @RequestParam("vehicleSize") VehicleSize vehicleSize) {
        return AvailabilityResponse.of(availability.findAvailable(start, end, vehicleSize));
    }
}
