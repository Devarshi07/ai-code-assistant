"""Inventory rules: products, warehouses, stock movements and reports."""
from datetime import datetime, timezone

from app.errors import ApiError, conflict, not_found
from app.repository import InMemoryRepository
from app.schemas import (
    LowStockItem,
    LowStockReport,
    Movement,
    MovementCreate,
    MovementResult,
    Product,
    ProductCreate,
    ProductStock,
    ProductUpdate,
    StockLine,
    Warehouse,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InventoryService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    # --- Products -------------------------------------------------------------

    def create_product(self, data: ProductCreate) -> Product:
        if self.repo.get_product(data.sku):
            raise conflict("duplicate_sku", f"A product with SKU '{data.sku}' already exists.", sku=data.sku)
        product = Product(**data.model_dump())
        self.repo.save_product(product)
        return product

    def get_product(self, sku: str) -> Product:
        product = self.repo.get_product(sku)
        if product is None:
            raise not_found("Product", sku)
        return product

    def list_products(self, category: str | None = None) -> list[Product]:
        products = self.repo.list_products()
        if category is not None:
            products = [p for p in products if p.category == category]
        return products

    def update_product(self, sku: str, changes: ProductUpdate) -> Product:
        """Partial update (PATCH): fields that are not sent keep their current value."""
        product = self.get_product(sku)
        updated = product.model_copy(update=changes.model_dump(exclude_none=True))
        self.repo.save_product(updated)
        return updated

    # --- Warehouses -----------------------------------------------------------

    def create_warehouse(self, data: Warehouse) -> Warehouse:
        if self.repo.get_warehouse(data.id):
            raise conflict("duplicate_warehouse", f"Warehouse '{data.id}' already exists.", id=data.id)
        self.repo.save_warehouse(data)
        return data

    def get_warehouse(self, warehouse_id: str) -> Warehouse:
        warehouse = self.repo.get_warehouse(warehouse_id)
        if warehouse is None:
            raise not_found("Warehouse", warehouse_id)
        return warehouse

    def list_warehouses(self) -> list[Warehouse]:
        return self.repo.list_warehouses()

    # --- Stock ----------------------------------------------------------------

    def record_movement(self, data: MovementCreate) -> MovementResult:
        """Receives goods into, or ships goods out of, one warehouse."""
        self.get_warehouse(data.warehouse_id)
        self.get_product(data.sku)
        current = self.repo.quantity(data.warehouse_id, data.sku)
        if data.kind == "ship" and data.quantity > current:
            raise conflict("insufficient_stock", f"Only {current} of '{data.sku}' in {data.warehouse_id}.",
                           available=current, requested=data.quantity)
        delta = data.quantity if data.kind == "receive" else -data.quantity
        movement = self._apply(data.warehouse_id, data.sku, data.kind, delta, note=data.note)
        return MovementResult(movement=movement, on_hand=self.repo.quantity(data.warehouse_id, data.sku))

    def _apply(self, warehouse_id: str, sku: str, kind: str, delta: int,
               reference: str | None = None, note: str | None = None) -> Movement:
        """Changes one stock level and writes the movement that explains it."""
        self.repo.set_quantity(warehouse_id, sku, self.repo.quantity(warehouse_id, sku) + delta)
        movement = Movement(id=self.repo.next_id("MV"), warehouse_id=warehouse_id, sku=sku, kind=kind,
                            quantity=abs(delta), reference=reference, note=note, created_at=_now())
        self.repo.add_movement(movement)
        return movement

    def product_stock(self, sku: str) -> ProductStock:
        self.get_product(sku)
        return ProductStock(sku=sku, on_hand=self.repo.on_hand(sku), by_warehouse=self.repo.by_warehouse(sku))

    def warehouse_stock(self, warehouse_id: str) -> list[StockLine]:
        self.get_warehouse(warehouse_id)
        return [StockLine(sku=sku, quantity=qty) for sku, qty in self.repo.stock_in(warehouse_id).items()]

    def movements_for(self, sku: str) -> list[Movement]:
        self.get_product(sku)
        return self.repo.movements_for(sku)

    def transfer(self, *args, **kwargs):
        """Moves stock of one product from one warehouse to another (see README)."""
        raise NotImplementedError("Phase 2: stock transfers between warehouses")

    def search_products(self, *args, **kwargs):
        """Filtered, sorted, paginated product search (see README)."""
        raise NotImplementedError("Phase 2: product search")

    # --- Reports --------------------------------------------------------------

    def low_stock_report(self, category: str | None = None, limit: int = 50) -> LowStockReport:
        """Active products whose total stock is below their reorder level.

        Sorted by shortfall (largest first), then SKU. ``total`` counts every
        low-stock product; ``items`` holds the first ``limit`` of them.
        """
        if limit < 1:
            raise ApiError(400, "invalid_limit", "limit must be at least 1.")
        items = []
        for product in self.repo.list_products():
            if not product.active or (category is not None and product.category != category):
                continue
            on_hand = self.repo.on_hand(product.sku)
            if on_hand < product.reorder_level:
                items.append(LowStockItem(sku=product.sku, name=product.name, category=product.category,
                                          on_hand=on_hand, reorder_level=product.reorder_level,
                                          shortfall=product.reorder_level - on_hand))
        items.sort(key=lambda item: (-item.shortfall, item.sku))
        return LowStockReport(items=items[:limit], total=len(items))
