"""Weight units.

Inside the service every weight is a whole number of grams. The WMS export
and the carrier labels use kilograms, so conversions happen only at the
edges: parse_weight_kg when an export is loaded, format_* when printing.
"""
import re

GRAMS_PER_KG = 1000

# The pack-bench scales read to the gram, so the export never carries more
# than three decimal places: "2", "0.5", "1.25", "0.035".
_READING = re.compile(r"\d+(\.\d+)?")


def parse_weight_kg(text):
    """Convert a kilogram reading from the WMS export to whole grams."""
    cleaned = str(text).strip()
    if not _READING.fullmatch(cleaned):
        raise ValueError(f"weight {text!r} is not a kilogram reading like 1.25")
    kilograms = float(cleaned)
    # Binary floats store 2.03 as 2.02999..., so truncating would lose a gram.
    return round(kilograms * GRAMS_PER_KG)


def format_grams(grams):
    """5435 -> '5,435 g'"""
    return f"{grams:,} g"


def format_kg(grams):
    """5435 -> '5.435 kg', the format printed on carrier labels."""
    return f"{grams // GRAMS_PER_KG}.{grams % GRAMS_PER_KG:03d} kg"
