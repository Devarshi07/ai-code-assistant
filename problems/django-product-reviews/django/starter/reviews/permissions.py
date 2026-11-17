from rest_framework.permissions import BasePermission


class IsModerator(BasePermission):
    """Only moderator accounts may add products or hide reviews."""

    message = "Only moderators can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_moderator)
