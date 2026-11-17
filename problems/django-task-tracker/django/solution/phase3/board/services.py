"""Business rules for the board. Views stay thin and call into here."""
from collections import namedtuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Q
from rest_framework.exceptions import ValidationError

from board.errors import InvalidTransition, NotFound
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
    return Task.objects.select_related("assignee").filter(project__members=user)


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


ORDERINGS = {
    "id": ["id"],
    "due_on": [F("due_on").asc(nulls_last=True), "id"],
    "-due_on": [F("due_on").desc(nulls_last=True), "id"],
    "priority": ["priority", "id"],
    "-priority": ["-priority", "id"],
}


def list_tasks(project, *, status=None, assignee=None, overdue=None, ordering="id",
               page=1, page_size=None, today=None):
    """One filtered, ordered page of the project's tasks."""
    page_size = page_size or settings.DEFAULT_PAGE_SIZE
    tasks = project.tasks.select_related("assignee")
    if status:
        tasks = tasks.filter(status=status)
    if assignee is not None:
        tasks = tasks.filter(assignee_id=assignee)
    if overdue is not None:
        late = Q(due_on__lt=today) & ~Q(status=Task.DONE)
        tasks = tasks.filter(late) if overdue else tasks.exclude(late)
    tasks = tasks.order_by(*ORDERINGS[ordering])
    start = (page - 1) * page_size
    return Page(list(tasks[start:start + page_size]), tasks.count(), page, page_size)


TRANSITIONS = {
    Task.TODO: [Task.IN_PROGRESS],
    Task.IN_PROGRESS: [Task.DONE, Task.TODO],
    Task.DONE: [Task.IN_PROGRESS],
}


def transition_task(user, task_id, to_status, reason=""):
    """Move a task to another status, following the workflow rules."""
    with transaction.atomic():
        task = get_task(user, task_id)
        allowed = TRANSITIONS[task.status]
        if to_status not in allowed:
            raise InvalidTransition(f"A {task.status} task cannot move to {to_status}.",
                                    **{"from": task.status, "to": to_status, "allowed": allowed})
        if task.status == Task.DONE:
            if not reason.strip():
                raise ValidationError({"reason": ["A reason is required to reopen a done task."]})
            task.reopen_reason = reason.strip()
        task.status = to_status
        task.save()
    return task


# ---------------------------------------------------------------- dashboard

def project_dashboard(project, today):
    """Counts for the project page, in two aggregate queries however many tasks there are."""
    overdue = Q(due_on__lt=today) & ~Q(status=Task.DONE)
    totals = project.tasks.aggregate(
        total=Count("id"),
        overdue=Count("id", filter=overdue),
        **{status: Count("id", filter=Q(status=status)) for status in Task.STATUSES})

    rows = (project.tasks.values("assignee_id", "assignee__username").annotate(count=Count("id"))
            .order_by(F("assignee__username").asc(nulls_last=True)))
    by_assignee = [{"assignee": None if row["assignee_id"] is None else
                    {"id": row["assignee_id"], "username": row["assignee__username"]},
                    "count": row["count"]} for row in rows]
    return {"project_id": project.id, "total": totals["total"],
            "by_status": {status: totals[status] for status in Task.STATUSES},
            "by_assignee": by_assignee, "overdue": totals["overdue"]}
