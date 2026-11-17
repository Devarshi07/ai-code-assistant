package com.debuggym.api.controller;

import com.debuggym.api.dto.RedeemRequest;
import com.debuggym.api.dto.RedemptionResponse;
import com.debuggym.api.model.Redemption;
import com.debuggym.api.service.PointsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/members/{memberId}/redemptions")
public class RedemptionController {
    private final PointsService service;

    public RedemptionController(PointsService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<RedemptionResponse> redeem(@PathVariable("memberId") String memberId,
                                                     @Valid @RequestBody RedeemRequest request) {
        Redemption redemption = service.redeem(memberId, request);
        return ResponseEntity.created(URI.create("/members/" + memberId + "/redemptions/" + redemption.id()))
                .body(RedemptionResponse.from(redemption));
    }
}
