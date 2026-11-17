package com.debuggym.api.service;

import com.debuggym.api.dto.CreateMemberRequest;
import com.debuggym.api.dto.MemberResponse;
import com.debuggym.api.dto.PageResponse;
import com.debuggym.api.dto.PurchaseResponse;
import com.debuggym.api.dto.RedeemRequest;
import com.debuggym.api.exception.NotFoundException;
import com.debuggym.api.model.LedgerEntry;
import com.debuggym.api.model.Member;
import com.debuggym.api.model.PointsLot;
import com.debuggym.api.model.Redemption;
import com.debuggym.api.repository.LedgerRepository;
import com.debuggym.api.repository.LotRepository;
import com.debuggym.api.repository.MemberRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Members, purchases, expiry, redemptions and statements. Every rule that needs
 * today's date takes it from the injected Clock.
 */
@Service
public class PointsService {
    private final MemberRepository members;
    private final LotRepository lots;
    private final LedgerRepository ledger;
    private final PointsPolicy policy;
    private final RewardCatalog rewards;
    private final Clock clock;

    public PointsService(MemberRepository members, LotRepository lots, LedgerRepository ledger,
                         PointsPolicy policy, RewardCatalog rewards, Clock clock) {
        this.members = members;
        this.lots = lots;
        this.ledger = ledger;
        this.policy = policy;
        this.rewards = rewards;
        this.clock = clock;
    }

    LocalDate today() {
        return LocalDate.now(clock);
    }

    public Member createMember(CreateMemberRequest request) {
        return members.save(new Member(members.nextId(), request.name().trim(), request.tier(), today()));
    }

    public Member getMember(String id) {
        return members.findById(id).orElseThrow(() -> NotFoundException.member(id));
    }

    /** The member with their spendable balance and lots. */
    public MemberResponse describe(String id) {
        Member member = getMember(id);
        expireDueLots(member);
        return MemberResponse.from(member, spendableLots(id));
    }

    /** Records a purchase: the member earns a new lot of points that expires in 12 months. */
    public PurchaseResponse earn(String id, BigDecimal amount) {
        Member member = getMember(id);
        expireDueLots(member);
        LocalDate today = today();
        int points = policy.pointsFor(member.getTier(), amount);
        int balance = balanceOf(lots.findByMember(id));
        if (points == 0) return new PurchaseResponse(0, balance, null, null);
        PointsLot lot = lots.save(new PointsLot(lots.nextId(), id, today, policy.expiryFor(today), points));
        balance += points;
        ledger.append(id, LedgerEntry.Type.EARN, points, balance, lot.getId(), null, today);
        return new PurchaseResponse(points, balance, lot.getId(), lot.getExpiresOn());
    }

    /**
     * Spends points on a reward, using the oldest unexpired lots first. Throws
     * InsufficientPointsException (409) when the spendable balance is too low.
     */
    public Redemption redeem(String memberId, RedeemRequest request) {
        throw new UnsupportedOperationException("Not implemented: redemptions (phase 2)");
    }

    /** One page of the member's statement, newest entry first. Pages are numbered from 0. */
    public PageResponse<LedgerEntry> statement(String memberId, int page, int size) {
        throw new UnsupportedOperationException("Not implemented: statement (phase 2)");
    }

    /**
     * Moves the leftover points of every lot that has expired into an EXPIRE
     * statement entry dated on the lot's expiry date. Call it before anything
     * that reads or spends the balance.
     */
    void expireDueLots(Member member) {
        LocalDate today = today();
        List<PointsLot> all = lots.findByMember(member.getId());
        int balance = balanceOf(all);
        for (PointsLot lot : all) {
            if (lot.getRemaining() > 0 && lot.isExpiredOn(today)) {
                balance -= lot.getRemaining();
                ledger.append(member.getId(), LedgerEntry.Type.EXPIRE, lot.getRemaining(), balance, lot.getId(), null, lot.getExpiresOn());
                lot.setRemaining(0);
            }
        }
    }

    /** Lots with points left that have not expired, soonest expiry first. */
    List<PointsLot> spendableLots(String memberId) {
        LocalDate today = today();
        return lots.findByMember(memberId).stream()
                .filter(l -> l.getRemaining() > 0 && !l.isExpiredOn(today))
                .sorted(Comparator.comparing(PointsLot::getExpiresOn))
                .toList();
    }

    static int balanceOf(List<PointsLot> list) {
        return list.stream().mapToInt(PointsLot::getRemaining).sum();
    }
}
