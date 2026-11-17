package com.debuggym.api.dto;

import com.debuggym.api.model.Member;
import com.debuggym.api.model.PointsLot;
import com.debuggym.api.model.Tier;

import java.time.LocalDate;
import java.util.List;

/** A member with their spendable balance and the lots it is made of, soonest expiry first. */
public record MemberResponse(String id, String name, Tier tier, int balance, List<LotView> lots) {
    public record LotView(String id, int points, LocalDate earnedOn, LocalDate expiresOn) {
    }

    public static MemberResponse from(Member member, List<PointsLot> spendable) {
        List<LotView> views = spendable.stream()
                .map(l -> new LotView(l.getId(), l.getRemaining(), l.getEarnedOn(), l.getExpiresOn()))
                .toList();
        int balance = spendable.stream().mapToInt(PointsLot::getRemaining).sum();
        return new MemberResponse(member.getId(), member.getName(), member.getTier(), balance, views);
    }
}
