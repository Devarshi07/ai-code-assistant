"""Inventory rules: products, warehouses, stock movements and reports."""
import threading
from datetime import datetime, timezone

from app.errors import ApiError, bad_request, conflict, not_found
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
    ProductSummary,
    ProductUpdate,
    SearchPage,
    StockLine,
    TransferRequest,
    TransferResult,
    Warehouse,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InventoryService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo
        # SKUs of active products whose total stock is below their reorder level.
        # Kept current by _refresh_low after every change that can affect it, so
        # the report never scans the whole catalogue.
        self._low: set[str] = set()
        # Idempotency-Key -> (request fingerprint, result of the first transfer).
        self._transfers_by_key: dict[str, tuple[dict, TransferResult]] = {}
        self._transfer_lock = threading.Lock()

    def _refresh_low(self, sku: str) -> None:
        product = self.repo.get_product(sku)
        if product is not None and product.active and self.repo.on_hand(sku) < product.reorder_level:
            self._low.add(sku)
        else:
            self._low.discard(sku)

    # --- Products -------------------------------------------------------------

    def create_product(self, data: ProductCreate) -> Product:
        if self.repo.get_product(data.sku):
            raise conflict("duplicate_sku", f"A product with SKU '{data.sku}' already exists.", sku=data.sku)
        product = Product(**data.model_dump())
        self.repo.save_product(product)
        self._refresh_low(product.sku)
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
        updated = product.model_copy(update=changes.model_dump(exclude_unset=True))
        self.repo.save_product(updated)
        self._refresh_low(sku)
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
        self._refresh_low(sku)
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

    def transfer(self, data: TransferRequest, idempotency_key: str | None = None) -> TransferResult:
        """Moves stock of one product from one warehouse to another.

        With an idempotency key, a retry of the same request returns the first
        result instead of moving stock again; the same key with a different
        body is a 409. Only successful transfers are remembered.
        """
        if idempotency_key is None:
            return self._transfer(data)
        fingerprint = data.model_dump()
        # One lock: sync routes run in a thread pool, and two retries arriving
        # together must not both move stock.
        with self._transfer_lock:
            seen = self._transfers_by_key.get(idempotency_key)
            if seen is not None:
                if seen[0] != fingerprint:
                    raise conflict("idempotency_conflict",
                                   "This Idempotency-Key was already used for a different transfer.",
                                   transfer_id=seen[1].id)
                return seen[1]
            result = self._transfer(data)
            self._transfers_by_key[idempotency_key] = (fingerprint, result)
            return result

    def _transfer(self, data: TransferRequest) -> TransferResult:
        """Moves the stock.

        Both sides are checked before anything changes, so a rejected transfer
        leaves stock untouched. Writes a transfer_out and a transfer_in movement
        that reference the transfer id.
        """
        self.get_product(data.sku)
        self.get_warehouse(data.from_warehouse)
        self.get_warehouse(data.to_warehouse)
        if data.from_warehouse == data.to_warehouse:
            raise bad_request("same_warehouse", "A transfer needs two different warehouses.")
        available = self.repo.quantity(data.from_warehouse, data.sku)
        if data.quantity > available:
            raise conflict("insufficient_stock", f"Only {available} of '{data.sku}' in {data.from_warehouse}.",
                           available=available, requested=data.quantity)
        transfer_id = self.repo.next_id("TR")
        self._apply(data.from_warehouse, data.sku, "transfer_out", -data.quantity, reference=transfer_id, note=data.note)
        self._apply(data.to_warehouse, data.sku, "transfer_in", data.quantity, reference=transfer_id, note=data.note)
        return TransferResult(id=transfer_id, sku=data.sku, from_warehouse=data.from_warehouse,
                              to_warehouse=data.to_warehouse, quantity=data.quantity,
                              from_on_hand=self.repo.quantity(data.from_warehouse, data.sku),
                              to_on_hand=self.repo.quantity(data.to_warehouse, data.sku))

    SORT_KEYS = {
        "name": lambda item: item.name.lower(),
        "price": lambda item: item.price_cents,
        "stock": lambda item: item.on_hand,
    }

    def search_products(self, q: str | None = None, category: str | None = None, min_price: int | None = None,
                        max_price: int | None = None, in_stock: bool | None = None, sort: str = "name",
                        page: int = 1, page_size: int = 20) -> SearchPage:
        """Filtered, sorted, paginated product search. Ties are broken by SKU."""
        if min_price is not None and max_price is not None and min_price > max_price:
            raise bad_request("invalid_range", "min_price cannot be greater than max_price.",
                              min_price=min_price, max_price=max_price)
        needle = q.lower() if q else None
        matches = []
        for product in self.repo.list_products():
            if category is not None and product.category != category:
                continue
            if min_price is not None and product.price_cents < min_price:
                continue
            if max_price is not None and product.price_cents > max_price:
                continue
            if needle and needle not in product.name.lower() and needle not in product.sku.lower():
                continue
            on_hand = self.repo.on_hand(product.sku)
            if in_stock is not None and (on_hand > 0) != in_stock:
                continue
            matches.append(ProductSummary(sku=product.sku, name=product.name, category=product.category,
                                          price_cents=product.price_cents, on_hand=on_hand))
        # list_products is already in SKU order and sort() is stable, so ties stay by SKU.
        descending = sort.startswith("-")
        matches.sort(key=self.SORT_KEYS[sort.lstrip("-")], reverse=descending)
        start = (page - 1) * page_size
        return SearchPage(items=matches[start:start + page_size], page=page, page_size=page_size, total=len(matches))

    # --- Reports --------------------------------------------------------------

    def low_stock_report(self, category: str | None = None, limit: int = 50) -> LowStockReport:
        """Active products whose total stock is below their reorder level.

        Sorted by shortfall (largest first), then SKU. ``total`` counts every
        low-stock product; ``items`` holds the first ``limit`` of them. Works
        from the maintained low-stock set: O(L log L) for L low products.
        """
        if limit < 1:
            raise ApiError(400, "invalid_limit", "limit must be at least 1.")
        ranked = []
        for sku in self._low:
            product = self.repo.products[sku]
            if category is None or product.category == category:
                ranked.append((self.repo.on_hand(sku) - product.reorder_level, sku, product))
        ranked.sort()
        items = [LowStockItem(sku=sku, name=p.name, category=p.category, on_hand=p.reorder_level + negative,
                              reorder_level=p.reorder_level, shortfall=-negative)
                 for negative, sku, p in ranked[:limit]]
        return LowStockReport(items=items, total=len(ranked))
