package com.debuggym.api.model;

/** One parking space. level 0 is the street level; negative levels are underground. */
public record Space(long id, String label, int level, VehicleSize size) {
}
