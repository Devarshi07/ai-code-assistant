"""Shared test setup. Every test runs inside a transaction that is rolled back."""
import os
import unittest
from datetime import timedelta
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import transaction  # noqa: E402
from django.test.utils import setup_test_environment  # noqa: E402
from django.utils import timezone  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from accounts.models import Account  # noqa: E402
from ticketing import services  # noqa: E402

setup_test_environment()
call_command("migrate", run_syncdb=True, verbosity=0)

# Tests run as if the server had been up for a couple of hours.
NOW = timezone.now().replace(microsecond=0) + timedelta(hours=2)


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = APIClient()
        self._atomic = transaction.atomic()
        self._atomic.__enter__()
        self.set_now(NOW)

    def tearDown(self):
        transaction.set_rollback(True)
        self._atomic.__exit__(None, None, None)

    def set_now(self, moment):
        """Pins ticketing.clock.now() for the rest of the test."""
        patcher = mock.patch("ticketing.clock.now", return_value=moment)
        patcher.start()
        self.addCleanup(patcher.stop)

    def as_account(self, account):
        """Sends the following requests as this account (None: anonymous)."""
        self.client.credentials(**({"HTTP_X_API_KEY": account.api_key} if account else {}))
        return self.client


def make_account(name, role="attendee"):
    slug = name.lower().replace(" ", ".")
    return Account.objects.create(name=name, email=f"{slug}@example.org", role=role, api_key=f"key-{slug}")


def make_event(organiser, sections=(("Floor", 2, 5, 4500),), name="Night Market Sessions"):
    """An event with a seating plan given as (section, rows, seats_per_row, price_cents)."""
    plan = [{"name": s, "rows": r, "seats_per_row": n, "price_cents": p} for s, r, n, p in sections]
    return services.create_event(organiser, name=name, venue="Harbour Hall", starts_at=NOW + timedelta(days=30), sections=plan)
