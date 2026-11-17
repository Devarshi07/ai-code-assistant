"""Shared test setup. Every test runs inside a transaction that is rolled back."""
import os
import unittest
from datetime import date
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.db import transaction  # noqa: E402
from django.test.utils import setup_test_environment  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

setup_test_environment()
call_command("migrate", run_syncdb=True, verbosity=0)

TODAY = date(2026, 3, 2)


class ApiTestCase(unittest.TestCase):
    today = TODAY

    def setUp(self):
        self.client = APIClient()
        self._atomic = transaction.atomic()
        self._atomic.__enter__()
        self.set_today(self.today)

    def tearDown(self):
        transaction.set_rollback(True)
        self._atomic.__exit__(None, None, None)

    def set_today(self, day):
        """Pins board.clock.today() for the rest of the test."""
        patcher = mock.patch("board.clock.today", return_value=day)
        patcher.start()
        self.addCleanup(patcher.stop)

    def sign_in(self, user):
        """Makes every following request come from `user`."""
        self.client.force_authenticate(user=user)


def make_user(username="priya"):
    return get_user_model().objects.create(username=username)


def make_project(name="Website relaunch", members=()):
    from board.models import Project
    project = Project.objects.create(name=name)
    project.members.add(*members)
    return project


def make_task(project, title="Write the launch post", **fields):
    from board.models import Task
    return Task.objects.create(project=project, title=title, **fields)
