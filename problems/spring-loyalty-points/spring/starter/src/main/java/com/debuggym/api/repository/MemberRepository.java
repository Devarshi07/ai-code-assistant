package com.debuggym.api.repository;

import com.debuggym.api.model.Member;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory member store. Members are never deleted. */
@Repository
public class MemberRepository {
    private final Map<String, Member> members = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public String nextId() {
        return "mem_" + sequence.incrementAndGet();
    }

    public Member save(Member member) {
        members.put(member.getId(), member);
        return member;
    }

    public Optional<Member> findById(String id) {
        return Optional.ofNullable(members.get(id));
    }
}
