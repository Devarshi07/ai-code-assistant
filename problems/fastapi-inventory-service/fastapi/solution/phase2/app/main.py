"""Application factory for the Stockroom inventory API."""
from fastapi import FastAPI

from app.errors import install_error_handlers
from app.repository import InMemoryRepository
from app.routers import products, reports, stock, transfers, warehouses
from app.services.inventory import InventoryService


def create_app() -> FastAPI:
    """Builds an app with its own empty in-memory store.

    Tests and the demo call this to get an isolated instance. Nothing here
    listens on a port; in production uvicorn serves ``app.main:app``.
    """
    app = FastAPI(title="Stockroom Inventory API", version="1.4.0")
    app.state.inventory = InventoryService(InMemoryRepository())
    install_error_handlers(app)

    app.include_router(products.router)
    app.include_router(warehouses.router)
    app.include_router(stock.router)
    app.include_router(transfers.router)
    app.include_router(reports.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
