"""Packing manifests (printed at the pack bench) and carrier labels."""
from .units import format_grams, format_kg


def format_manifest(order_id, cartons):
    """The bench sheet: one block per carton, identical units grouped."""
    count = len(cartons)
    total = sum(carton.weight_g for carton in cartons)
    lines = [f"Order {order_id}: {_plural(count, 'carton')}, {format_grams(total)}"]
    for carton in cartons:
        lines.append(_heading(carton, count))
        for item, quantity in group_units(carton.items):
            lines.append(f"    {quantity:>3} x {item.sku:<12} {item.description[:30]:<30} "
                         f"{format_grams(item.weight_g * quantity):>9}")
    return "\n".join(lines)


def carrier_labels(order_id, cartons):
    """Declared weight for each carton, as printed on the carrier label."""
    count = len(cartons)
    return [f"{order_id}-{carton.number}/{count} {carton.carton_type.code} {format_kg(carton.weight_g)}"
            for carton in cartons]


def group_units(items):
    """[(item, quantity)] with units of the same SKU merged, in first-packed order."""
    groups = {}
    for item in items:
        first, quantity = groups.get(item.sku, (item, 0))
        groups[item.sku] = (first, quantity + 1)
    return list(groups.values())


def _heading(carton, count):
    marks = "".join(f"  {flag.upper()}" for flag, on in
                    (("fragile", carton.fragile), ("hazmat", carton.hazmat)) if on)
    return (f"  Carton {carton.number}/{count}  {carton.carton_type.name:<10} "
            f"{format_grams(carton.weight_g):>9} of {format_grams(carton.limit_g)}{marks}")


def _plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"
