"""Unit conversion and the small numeric helpers shared by the services."""


def to_celsius(value: float, unit: str) -> float:
    """Converts a station's temperature to Celsius, rounded to 2 decimals."""
    if unit == "F":
        # 32 F is the freezing point.
        return round((value - 32) * 5 / 9, 2)
    return round(value, 2)


def to_hundredths(celsius: float) -> int:
    """Temperatures are summed as integer hundredths of a degree to avoid float drift."""
    return round(celsius * 100)


def mean_c(total_hundredths: int, count: int) -> float:
    """Mean temperature in Celsius, rounded half up to 2 decimals (pure integer arithmetic)."""
    return ((2 * total_hundredths + count) // (2 * count)) / 100
