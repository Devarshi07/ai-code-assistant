package com.debuggym.api.controller;

import com.debuggym.api.dto.RedeemRequest;
import com.debuggym.api.dto.RedemptionResponse;
import com.debuggym.api.exception.ValidationFailedException;
import com.debuggym.api.model.Redemption;
import com.debuggym.api.service.PointsService;
import com.debuggym.api.service.RedemptionOutcome;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/members/{memberId}/redemptions")
public class RedemptionController {
    private static final Pattern KEY = Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private final PointsService service;

    public RedemptionController(PointsService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<RedemptionResponse> redeem(@PathVariable("memberId") String memberId,
                                                     @Valid @RequestBody RedeemRequest request,
                                                     @RequestHeader(name = "Idempotency-Key", required = false) String key) {
        if (key != null && !KEY.matcher(key).matches())
            throw new ValidationFailedException("Idempotency-Key", "must be 1 to 64 letters, digits, '-' or '_'");
        RedemptionOutcome outcome = service.redeem(memberId, request, key);
        Redemption redemption = outcome.redemption();
        return ResponseEntity.created(URI.create("/members/" + memberId + "/redemptions/" + redemption.id()))
                .header("Idempotent-Replayed", String.valueOf(outcome.replayed()))
                .body(RedemptionResponse.from(redemption));
    }
}
