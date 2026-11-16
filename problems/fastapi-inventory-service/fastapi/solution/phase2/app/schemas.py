"""Request and response models (Pydantic v2).

Money is stored as integer cents and quantities as integers, so nothing in the
service ever rounds.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

SKU_PATTERN = r"^[A-Z0-9][A-Z0-9-]{2,31}$"
WAREHOUSE_PATTERN = r"^[A-Z]{3}-[0-9]{1,3}$"

MovementKind = Literal["receive", "ship", "transfer_out", "transfer_in"]


# --- Products -----------------------------------------------------------------

class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    price_cents: int = Field(ge=0)
    reorder_level: int = Field(default=0, ge=0, description="Restock when total stock falls below this.")
    description: str | None = Field(default=None, max_length=500)
    active: bool = Field(default=True, description="False once a product is discontinued.")


class ProductCreate(ProductBase):
    sku: str = Field(pattern=SKU_PATTERN)


class Product(ProductBase):
    sku: str


class ProductUpdate(ProductBase):
    """Body of PATCH /products/{sku}. Only the fields that are sent change."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    price_cents: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _required_fields_are_not_null(self) -> "ProductUpdate":
        # description may be cleared with null; these may not.
        for name in ("name", "category", "price_cents"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


# --- Warehouses ---------------------------------------------------------------

class Warehouse(BaseModel):
    id: str = Field(pattern=WAREHOUSE_PATTERN, examples=["BOS-1"])
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=80)


# --- Stock --------------------------------------------------------------------

class MovementCreate(BaseModel):
    """Body of POST /movements: goods received into, or shipped out of, one warehouse."""

    warehouse_id: str
    sku: str
    kind: Literal["receive", "ship"]
    quantity: int = Field(gt=0, le=1_000_000)
    note: str | None = Field(default=None, max_length=200)


class Movement(BaseModel):
    id: str
    warehouse_id: str
    sku: str
    kind: MovementKind
    quantity: int
    reference: str | None = None
    note: str | None = None
    created_at: datetime


class MovementResult(BaseModel):
    movement: Movement
    on_hand: int = Field(description="Quantity left in that warehouse after the movement.")


class ProductStock(BaseModel):
    sku: str
    on_hand: int
    by_warehouse: dict[str, int]


class StockLine(BaseModel):
    sku: str
    quantity: int


# --- Reports ------------------------------------------------------------------

class LowStockItem(BaseModel):
    sku: str
    name: str
    category: str
    on_hand: int
    reorder_level: int
    shortfall: int


class LowStockReport(BaseModel):
    items: list[LowStockItem]
    total: int = Field(description="Number of low-stock products before the limit is applied.")


# --- Transfers ----------------------------------------------------------------

class TransferRequest(BaseModel):
    """Body of POST /transfers."""

    sku: str
    from_warehouse: str
    to_warehouse: str
    quantity: int = Field(gt=0, le=1_000_000)
    note: str | None = Field(default=None, max_length=200)


class TransferResult(BaseModel):
    id: str
    sku: str
    from_warehouse: str
    to_warehouse: str
    quantity: int
    from_on_hand: int
    to_on_hand: int


# --- Search -------------------------------------------------------------------

SearchSort = Literal["name", "-name", "price", "-price", "stock", "-stock"]


class ProductSummary(BaseModel):
    sku: str
    name: str
    category: str
    price_cents: int
    on_hand: int


class SearchPage(BaseModel):
    items: list[ProductSummary]
    page: int
    page_size: int
    total: int
