package com.debuggym.api.model;

/** Space and vehicle sizes, smallest first. A vehicle fits any space of its size or larger. */
public enum VehicleSize {
    MOTORCYCLE, COMPACT, STANDARD, LARGE;

    public boolean fitsIn(VehicleSize space) {
        return space.ordinal() >= ordinal();
    }
}
