package com.debuggym.api.dto;

import java.util.List;
import java.util.function.Function;

/** One page of a list. page is 1-based; totalPages is 0 when there are no items. */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {
    public <R> PageResponse<R> map(Function<T, R> mapper) {
        return new PageResponse<>(items.stream().map(mapper).toList(), page, size, totalItems, totalPages);
    }
}
