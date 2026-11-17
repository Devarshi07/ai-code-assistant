"""Business rules for the board. Views stay thin and call into here."""
from collections import namedtuple

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from board.errors import NotFound
from board.models import Project, Task

User = get_user_model()

Page = namedtuple("Page", "items count page page_size")


# ---------------------------------------------------------------- access

def get_project(user, project_id):
    """A project the user belongs to. Anyone else gets a 404, as if it did not exist."""
    project = Project.objects.filter(pk=project_id, members=user).first()
    if project is None:
        raise NotFound("Project not found.")
    return project


def visible_tasks(user):
    """Every task the user is allowed to see."""
    return Task.objects.select_related("assignee")


def get_task(user, task_id):
    task = visible_tasks(user).filter(pk=task_id).first()
    if task is None:
        raise NotFound("Task not found.")
    return task


# ---------------------------------------------------------------- tasks

def _check_assignee(project, data):
    assignee_id = data.get("assignee_id")
    if assignee_id is not None and not project.members.filter(pk=assignee_id).exists():
        raise ValidationError({"assignee_id": ["The assignee must be a member of the project."]})


def create_task(project, data):
    _check_assignee(project, data)
    task = Task.objects.create(project=project, **data)
    return Task.objects.select_related("assignee").get(pk=task.pk)


def update_task(task, data):
    _check_assignee(task.project, data)
    for field, value in data.items():
        setattr(task, field, value)
    task.save()
    return Task.objects.select_related("assignee").get(pk=task.pk)


def list_tasks(project):
    """One page of the project's tasks, oldest first."""
    # Phase 2: filters (status, assignee, overdue), ordering and real pagination.
    size = settings.DEFAULT_PAGE_SIZE
    return Page(list(project.tasks.all()[:size]), project.tasks.count(), 1, size)


def transition_task(user, task_id, to_status, reason=""):
    """Move a task to another status, following the workflow rules."""
    raise NotImplementedError("Phase 2: status transitions with the rules in the README")


# ---------------------------------------------------------------- dashboard

def project_dashboard(project, today):
    """Counts for the project page: per status, per assignee, and overdue."""
    by_status = {status: project.tasks.filter(status=status).count() for status in Task.STATUSES}

    by_assignee = []
    for user in User.objects.filter(assigned_tasks__project=project).distinct().order_by("username"):
        by_assignee.append({"assignee": {"id": user.id, "username": user.username},
                            "count": project.tasks.filter(assignee=user).count()})
    unassigned = project.tasks.filter(assignee__isnull=True).count()
    if unassigned:
        by_assignee.append({"assignee": None, "count": unassigned})

    overdue = sum(1 for task in project.tasks.all() if task.is_overdue(today))
    return {"project_id": project.id, "total": sum(by_status.values()), "by_status": by_status,
            "by_assignee": by_assignee, "overdue": overdue}
