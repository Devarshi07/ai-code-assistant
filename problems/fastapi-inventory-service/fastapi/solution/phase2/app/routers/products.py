"""/products: the catalogue."""
from fastapi import APIRouter, Query

from app.dependencies import Inventory
from app.schemas import Movement, Product, ProductCreate, ProductStock, ProductUpdate, SearchPage, SearchSort

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=Product, status_code=201)
def create_product(payload: ProductCreate, inventory: Inventory) -> Product:
    return inventory.create_product(payload)


@router.get("", response_model=list[Product])
def list_products(inventory: Inventory, category: str | None = None) -> list[Product]:
    return inventory.list_products(category)


# Declared before /{sku}, which would otherwise match "search" as a SKU.
@router.get("/search", response_model=SearchPage)
def search_products(
    inventory: Inventory,
    q: str | None = Query(default=None, max_length=100),
    category: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    in_stock: bool | None = None,
    sort: SearchSort = "name",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SearchPage:
    return inventory.search_products(q=q, category=category, min_price=min_price, max_price=max_price,
                                     in_stock=in_stock, sort=sort, page=page, page_size=page_size)


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
