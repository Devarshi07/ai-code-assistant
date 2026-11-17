package com.debuggym.api.dto;

import com.debuggym.api.model.Redemption;

import java.time.LocalDate;
import java.util.List;

public record RedemptionResponse(String id, String memberId, String rewardId, int quantity, int pointsSpent,
                                 int balance, List<Redemption.LotUse> lots, LocalDate date) {
    public static RedemptionResponse from(Redemption r) {
        return new RedemptionResponse(r.id(), r.memberId(), r.rewardId(), r.quantity(), r.pointsSpent(),
                r.balance(), r.lots(), r.date());
    }
}
