"""Loads orders from the WMS order export (CSV).

    order_id,sku,description,weight_kg,qty,flags
    A1001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile

weight_kg is the weight of ONE unit. flags is empty or a '|'-separated list
drawn from: fragile, hazmat. Lines of one order need not be adjacent; orders
come back in the order they first appear in the export.
"""
import csv
import io
import re

from .catalog import Item, Order, OrderLine
from .units import parse_weight_kg

COLUMNS = ["order_id", "sku", "description", "weight_kg", "qty", "flags"]
FLAGS = ("fragile", "hazmat")


class OrderFormatError(ValueError):
    """The export is malformed. The message names the offending line."""


def load_orders(text):
    rows = csv.reader(io.StringIO(text))
    header = [cell.strip() for cell in next(rows, [])]
    if header != COLUMNS:
        raise OrderFormatError(f"line 1: expected header {','.join(COLUMNS)}")
    orders = {}
    for line_no, row in enumerate(rows, start=2):
        if not any(cell.strip() for cell in row):
            continue
        if len(row) != len(COLUMNS):
            raise OrderFormatError(f"line {line_no}: expected {len(COLUMNS)} fields, found {len(row)}")
        order_id, sku, description, weight, qty, flags = (cell.strip() for cell in row)
        try:
            fragile, hazmat = _parse_flags(flags)
            item = Item(sku, description, parse_weight_kg(weight), fragile, hazmat)
            quantity = _parse_quantity(qty)
        except ValueError as exc:
            raise OrderFormatError(f"line {line_no}: {exc}") from None
        order = orders.setdefault(order_id, Order(order_id))
        order.lines.append(OrderLine(item, quantity))
    return list(orders.values())


def read_orders(path):
    with open(path, encoding="utf-8") as handle:
        return load_orders(handle.read())


def _parse_flags(text):
    names = [name.strip().lower() for name in text.split("|") if name.strip()]
    unknown = [name for name in names if name not in FLAGS]
    if unknown:
        raise ValueError(f"unknown flag {unknown[0]!r}")
    return "fragile" in names, "hazmat" in names


def _parse_quantity(text):
    if not re.fullmatch(r"\d+", text) or int(text) < 1:
        raise ValueError(f"quantity {text!r} must be a whole number, at least 1")
    return int(text)
