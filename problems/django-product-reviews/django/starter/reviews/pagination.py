"""Page numbers for list endpoints: `?page=<n>&page_size=<n>`."""
from django.conf import settings
from rest_framework import serializers


class PageParams(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, required=False, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=settings.MAX_PAGE_SIZE, required=False,
                                         default=settings.DEFAULT_PAGE_SIZE)


def paginate(queryset, query_params):
    """Returns (items, meta) for the requested page of an ordered queryset.

    A page past the end is not an error: it has no items. Bad `page` or
    `page_size` values raise a 400 `validation_error`.
    """
    params = PageParams(data=query_params)
    params.is_valid(raise_exception=True)
    page, size = params.validated_data["page"], params.validated_data["page_size"]
    items = list(queryset[(page - 1) * size: page * size])
    return items, {"count": queryset.count(), "page": page, "page_size": size}
