"""/reports: read-only views for the warehouse dashboard."""
from fastapi import APIRouter, Query

from app.dependencies import Inventory
from app.schemas import LowStockReport

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/low-stock", response_model=LowStockReport)
def low_stock(inventory: Inventory, category: str | None = None,
              limit: int = Query(default=50, ge=1, le=500)) -> LowStockReport:
    # The dashboard polls this every few seconds for every open tab.
    return inventory.low_stock_report(category=category, limit=limit)
