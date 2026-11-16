package com.debuggym.api.repository;

import com.debuggym.api.model.Space;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory space store. */
@Repository
public class SpaceRepository {
    private final Map<Long, Space> spaces = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public long nextId() {
        return sequence.incrementAndGet();
    }

    public Space save(Space space) {
        spaces.put(space.id(), space);
        return space;
    }

    public Optional<Space> findById(long id) {
        return Optional.ofNullable(spaces.get(id));
    }

    /** Every space, by id. */
    public List<Space> findAll() {
        return spaces.values().stream().sorted(Comparator.comparingLong(Space::id)).toList();
    }
}
