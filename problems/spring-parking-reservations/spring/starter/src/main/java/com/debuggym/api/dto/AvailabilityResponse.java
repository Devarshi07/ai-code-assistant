package com.debuggym.api.dto;

import com.debuggym.api.model.Space;

import java.util.List;

public record AvailabilityResponse(int count, List<Space> spaces) {
    public static AvailabilityResponse of(List<Space> spaces) {
        return new AvailabilityResponse(spaces.size(), spaces);
    }
}
