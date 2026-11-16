"""/products: the catalogue."""
from fastapi import APIRouter

from app.dependencies import Inventory
from app.schemas import Movement, Product, ProductCreate, ProductStock, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=Product, status_code=201)
def create_product(payload: ProductCreate, inventory: Inventory) -> Product:
    return inventory.create_product(payload)


@router.get("", response_model=list[Product])
def list_products(inventory: Inventory, category: str | None = None) -> list[Product]:
    return inventory.list_products(category)


@router.get("/{sku}", response_model=Product)
def get_product(sku: str, inventory: Inventory) -> Product:
    return inventory.get_product(sku)


@router.patch("/{sku}", response_model=Product)
def update_product(sku: str, payload: ProductUpdate, inventory: Inventory) -> Product:
    return inventory.update_product(sku, payload)


@router.get("/{sku}/stock", response_model=ProductStock)
def product_stock(sku: str, inventory: Inventory) -> ProductStock:
    return inventory.product_stock(sku)


@router.get("/{sku}/movements", response_model=list[Movement])
def product_movements(sku: str, inventory: Inventory) -> list[Movement]:
    return inventory.movements_for(sku)
