"""Error responses.

Every error the API returns has the same shape, so the storefront can show it
without special cases:

    {"error": {"code": "already_reviewed", "message": "...", ...extra fields}}
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


class AlreadyReviewed(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "already_reviewed"


class AlreadyVoted(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "already_voted"


class NotAuthor(ApiError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "not_author"


class OwnReview(ApiError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "own_review"


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
    if response is not None:
        response.data = error_body(getattr(exc, "default_code", "error"), str(getattr(exc, "detail", exc)))
    return response
