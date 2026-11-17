from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from board.models import Project, Task

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name"]


class TaskSerializer(serializers.ModelSerializer):
    """The JSON shape of a task in every response."""

    assignee = UserSummarySerializer(read_only=True)

    class Meta:
        model = Task
        fields = ["id", "project_id", "title", "status", "priority", "due_on", "assignee", "reopen_reason"]


class TaskWriteSerializer(serializers.Serializer):
    """Body of POST /projects/<id>/tasks/ and PATCH /tasks/<id>/. Status is not editable here."""

    title = serializers.CharField(max_length=200)
    assignee_id = serializers.IntegerField(allow_null=True, required=False)
    priority = serializers.IntegerField(min_value=Task.LOW, max_value=Task.HIGH, required=False)
    due_on = serializers.DateField(allow_null=True, required=False)


class TransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.STATUSES)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class TaskFilters(serializers.Serializer):
    """Query parameters of GET /projects/<id>/tasks/."""

    ORDERINGS = ("id", "due_on", "-due_on", "priority", "-priority")

    status = serializers.ChoiceField(choices=Task.STATUSES, required=False)
    assignee = serializers.IntegerField(required=False, min_value=1)
    # A ChoiceField, not a BooleanField: a missing boolean in a query string reads as False.
    overdue = serializers.ChoiceField(choices=["true", "false"], required=False)
    ordering = serializers.ChoiceField(choices=ORDERINGS, required=False, default="id")
    page = serializers.IntegerField(required=False, min_value=1, default=1)
    page_size = serializers.IntegerField(required=False, min_value=1, max_value=settings.MAX_PAGE_SIZE,
                                         default=settings.DEFAULT_PAGE_SIZE)
