"""Shared test setup. Every test runs inside a transaction that is rolled back."""
import os
import unittest
from datetime import date
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

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
        """Pins library.clock.today() for the rest of the test."""
        patcher = mock.patch("library.clock.today", return_value=day)
        patcher.start()
        self.addCleanup(patcher.stop)


def make_member(name="Ada Lovelace", email=None):
    from library.models import Member
    return Member.objects.create(name=name, email=email or f"{name.lower().replace(' ', '.')}@example.org", joined_on=date(2025, 1, 6))


def make_book(title="The Salt Road Atlas", copies=1, isbn=None, author="Mira Okafor"):
    from library.models import Book
    return Book.objects.create(title=title, author=author, copies=copies, isbn=isbn or f"978-{Book.objects.count() + 1:010d}")
