from django.conf import settings
from django.db import models


class Project(models.Model):
    """A board owned by a small team. Only members can see or change its tasks."""

    name = models.CharField(max_length=120)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="projects")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class Task(models.Model):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    STATUSES = (TODO, IN_PROGRESS, DONE)

    LOW, NORMAL, HIGH = 1, 2, 3  # priority: a higher number is more urgent

    project = models.ForeignKey(Project, related_name="tasks", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="assigned_tasks",
                                 null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=12, choices=[(s, s) for s in STATUSES], default=TODO)
    priority = models.PositiveSmallIntegerField(default=NORMAL)
    due_on = models.DateField(null=True, blank=True)
    # Why the task was last reopened from `done`; empty if it never was.
    reopen_reason = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.title

    def is_overdue(self, today):
        return self.status != self.DONE and self.due_on is not None and self.due_on < today
