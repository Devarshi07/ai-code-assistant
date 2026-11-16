"""In-memory storage for products, warehouses, stock levels and movements.

The production service keeps the same interface over PostgreSQL; this version
keeps everything in dictionaries so the API runs without a database.
"""
from collections import defaultdict
from itertools import count

from app.schemas import Movement, Product, Warehouse


class InMemoryRepository:
    def __init__(self) -> None:
        self.products: dict[str, Product] = {}
        self.warehouses: dict[str, Warehouse] = {}
        # (warehouse_id, sku) -> quantity. Missing means zero.
        self.stock: dict[tuple[str, str], int] = {}
        self.movements: list[Movement] = []
        self._sequences: dict[str, count] = defaultdict(lambda: count(1))

    def next_id(self, prefix: str) -> str:
        """Readable sequential ids per prefix: MV-000001, MV-000002, ..."""
        return f"{prefix}-{next(self._sequences[prefix]):06d}"

    # Products

    def get_product(self, sku: str) -> Product | None:
        return self.products.get(sku)

    def save_product(self, product: Product) -> None:
        self.products[product.sku] = product

    def list_products(self) -> list[Product]:
        return [self.products[sku] for sku in sorted(self.products)]

    # Warehouses

    def get_warehouse(self, warehouse_id: str) -> Warehouse | None:
        return self.warehouses.get(warehouse_id)

    def save_warehouse(self, warehouse: Warehouse) -> None:
        self.warehouses[warehouse.id] = warehouse

    def list_warehouses(self) -> list[Warehouse]:
        return [self.warehouses[key] for key in sorted(self.warehouses)]

    # Stock

    def quantity(self, warehouse_id: str, sku: str) -> int:
        return self.stock.get((warehouse_id, sku), 0)

    def set_quantity(self, warehouse_id: str, sku: str, quantity: int) -> None:
        if quantity < 0:
            raise ValueError("stock cannot go negative")
        self.stock[(warehouse_id, sku)] = quantity

    def on_hand(self, sku: str) -> int:
        """Total quantity of one product across all warehouses."""
        return sum(self.stock.get((warehouse_id, sku), 0) for warehouse_id in self.warehouses)

    def by_warehouse(self, sku: str) -> dict[str, int]:
        return {warehouse_id: self.stock.get((warehouse_id, sku), 0) for warehouse_id in sorted(self.warehouses)}

    def stock_in(self, warehouse_id: str) -> dict[str, int]:
        return {sku: qty for (wid, sku), qty in sorted(self.stock.items()) if wid == warehouse_id and qty}

    # Movements

    def add_movement(self, movement: Movement) -> None:
        self.movements.append(movement)

    def movements_for(self, sku: str) -> list[Movement]:
        return [m for m in self.movements if m.sku == sku]
