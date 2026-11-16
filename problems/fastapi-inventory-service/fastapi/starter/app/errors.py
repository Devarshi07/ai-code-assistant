"""The API's error format and the handlers that produce it.

Every error response has the same shape:

    {"error": {"code": "insufficient_stock", "message": "...", "details": {...}}}

Request validation failures use code "validation_error" and list the bad
fields instead of details:

    {"error": {"code": "validation_error", "message": "...", "fields": {"body.quantity": "..."}}}
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """Raised by services; turned into a JSON error response by the handler below."""

    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details

    def body(self) -> dict:
        error = {"code": self.code, "message": self.message}
        if self.details:
            error["details"] = self.details
        return {"error": error}


def not_found(kind: str, key: str) -> ApiError:
    return ApiError(404, "not_found", f"{kind} '{key}' does not exist.")


def conflict(code: str, message: str, **details) -> ApiError:
    return ApiError(409, code, message, details or None)


def bad_request(code: str, message: str, **details) -> ApiError:
    return ApiError(400, code, message, details or None)


def _field_name(loc) -> str:
    return ".".join(str(part) for part in loc)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(exc.body(), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            fields.setdefault(_field_name(error["loc"]), error["msg"])
        body = {"error": {"code": "validation_error", "message": "The request is invalid.", "fields": fields}}
        return JSONResponse(body, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        body = {"error": {"code": code, "message": str(exc.detail)}}
        return JSONResponse(body, status_code=exc.status_code, headers=getattr(exc, "headers", None))
