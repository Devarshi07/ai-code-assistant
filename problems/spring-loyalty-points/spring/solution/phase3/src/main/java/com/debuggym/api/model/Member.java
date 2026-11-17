package com.debuggym.api.model;

import java.time.LocalDate;
import java.util.concurrent.locks.ReentrantLock;

/**
 * A loyalty programme member. Their points live in PointsLot objects. The lock
 * guards everything that reads or changes the lots and statement of this member.
 */
public class Member {
    private final String id;
    private final String name;
    private final Tier tier;
    private final LocalDate joinedOn;
    private final ReentrantLock lock = new ReentrantLock();

    public Member(String id, String name, Tier tier, LocalDate joinedOn) {
        this.id = id;
        this.name = name;
        this.tier = tier;
        this.joinedOn = joinedOn;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public Tier getTier() { return tier; }
    public LocalDate getJoinedOn() { return joinedOn; }
    public ReentrantLock lock() { return lock; }
}
