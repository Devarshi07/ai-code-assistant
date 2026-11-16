"""A small sample catalogue for the demo and for local development."""
from app.schemas import MovementCreate, ProductCreate, Warehouse
from app.services.inventory import InventoryService

WAREHOUSES = [
    Warehouse(id="BOS-1", name="Boston Docks", city="Boston"),
    Warehouse(id="CHI-2", name="Chicago West", city="Chicago"),
    Warehouse(id="DEN-1", name="Denver Hub", city="Denver"),
]

PRODUCTS = [
    ProductCreate(sku="TEA-EARL-250", name="Earl Grey, 250 g", category="tea", price_cents=899, reorder_level=40),
    ProductCreate(sku="TEA-SENCHA-100", name="Sencha, 100 g", category="tea", price_cents=1250, reorder_level=25),
    ProductCreate(sku="MUG-STONE-12", name="Stoneware mug, 12 oz", category="kitchen", price_cents=1600, reorder_level=30),
    ProductCreate(sku="KETTLE-GOOSE", name="Gooseneck kettle", category="kitchen", price_cents=5900, reorder_level=8,
                  description="1 litre, stovetop."),
    ProductCreate(sku="FILTER-PAPER-100", name="Paper filters, 100 pack", category="coffee", price_cents=450, reorder_level=60),
    ProductCreate(sku="BEANS-HOUSE-1K", name="House blend beans, 1 kg", category="coffee", price_cents=2400, reorder_level=20),
]

RECEIPTS = [
    ("BOS-1", "TEA-EARL-250", 30), ("CHI-2", "TEA-EARL-250", 18), ("DEN-1", "TEA-SENCHA-100", 12),
    ("BOS-1", "MUG-STONE-12", 45), ("CHI-2", "KETTLE-GOOSE", 3), ("DEN-1", "FILTER-PAPER-100", 25),
    ("BOS-1", "BEANS-HOUSE-1K", 14), ("CHI-2", "BEANS-HOUSE-1K", 9),
]


def seed_demo(service: InventoryService) -> None:
    for warehouse in WAREHOUSES:
        service.create_warehouse(warehouse)
    for product in PRODUCTS:
        service.create_product(product)
    for warehouse_id, sku, quantity in RECEIPTS:
        service.record_movement(MovementCreate(warehouse_id=warehouse_id, sku=sku, kind="receive", quantity=quantity))
    service.record_movement(MovementCreate(warehouse_id="BOS-1", sku="BEANS-HOUSE-1K", kind="ship", quantity=4,
                                           note="order 51-1182"))
