from rest_framework.permissions import BasePermission


class IsOrganiser(BasePermission):
    """Only organiser accounts may create events."""

    message = "Only organisers can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_organiser)


class IsEventOrganiser(BasePermission):
    """Only the organiser who runs an event may see its orders.

    Views check it with `self.check_object_permissions(request, event)`.
    Attendees, and organisers of other events, are refused with 403.
    """

    message = "Only this event's organiser can see its orders."

    def has_object_permission(self, request, view, event):
        raise NotImplementedError("Phase 2: allow only the event's organiser")
