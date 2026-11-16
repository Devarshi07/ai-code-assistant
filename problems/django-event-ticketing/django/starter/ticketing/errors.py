"""Error responses.

Every error has the same shape, so both apps can handle it in one place:

    {"error": {"code": "seats_unavailable", "message": "...", ...extra fields}}
"""
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApiError(exceptions.APIException):
    """A business-rule error with a stable machine-readable code."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message, **extra):
        super().__init__(message)
        self.message = message
        self.extra = extra


class NotFound(ApiError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class Forbidden(ApiError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class SeatsUnavailable(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "seats_unavailable"


class HoldExpired(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "hold_expired"


class AlreadyOrdered(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "already_ordered"


class InvalidRequest(ApiError):
    """A business-rule problem with the request body, reported like a validation error."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "validation_error"


def error_body(code, message, **extra):
    return {"error": {"code": code, "message": message, **extra}}


def api_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return Response(error_body(exc.code, exc.message, **exc.extra), status=exc.status_code)
    if isinstance(exc, exceptions.ValidationError):
        fields = exc.detail if isinstance(exc.detail, dict) else {"non_field_errors": exc.detail}
        return Response(error_body("validation_error", "The request is not valid.", fields=fields), status=400)
    if isinstance(exc, (Http404, exceptions.NotFound)):
        return Response(error_body("not_found", "Not found."), status=404)
    response = exception_handler(exc, context)
    if response is None:
        return None
    codes = {401: "not_authenticated", 403: "forbidden", 405: "method_not_allowed"}
    code = codes.get(response.status_code, getattr(exc, "default_code", "error"))
    response.data = error_body(code, str(getattr(exc, "detail", exc)))
    return response
