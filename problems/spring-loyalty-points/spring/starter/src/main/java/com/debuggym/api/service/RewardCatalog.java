package com.debuggym.api.service;

import com.debuggym.api.exception.NotFoundException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The rewards members can spend points on. A fixed list for now. */
@Component
public class RewardCatalog {
    public record Reward(String id, String name, int points) {
    }

    private final Map<String, Reward> rewards = List.of(
            new Reward("pastry", "Any pastry", 100),
            new Reward("free-coffee", "Free coffee, any size", 150),
            new Reward("tote-bag", "Bean and Brew tote bag", 400)
    ).stream().collect(Collectors.toMap(Reward::id, Function.identity()));

    /** The reward with this id, or a 404 reward_not_found. */
    public Reward require(String id) {
        Reward reward = rewards.get(id);
        if (reward == null) throw NotFoundException.reward(id);
        return reward;
    }
}
