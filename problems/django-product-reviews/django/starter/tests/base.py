"""Shared test setup. Every test runs inside a transaction that is rolled back."""
import os
import unittest
from datetime import datetime, timezone
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import transaction  # noqa: E402
from django.test.utils import setup_test_environment  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from accounts.models import Account  # noqa: E402

setup_test_environment()
call_command("migrate", run_syncdb=True, verbosity=0)

NOW = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)


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
        """Pins reviews.clock.now() for the rest of the test."""
        patcher = mock.patch("reviews.clock.now", return_value=moment)
        patcher.start()
        self.addCleanup(patcher.stop)

    def as_account(self, account):
        """Sends the following requests as this account (None: anonymous)."""
        self.client.credentials(**({"HTTP_X_API_KEY": account.api_key} if account else {}))
        return self.client


def make_account(name="Ada Lovelace", role="shopper"):
    slug = name.lower().replace(" ", ".")
    return Account.objects.create(name=name, email=f"{slug}@example.org", role=role, api_key=f"key-{slug}")


def make_product(name="Trail Mug", sku=None):
    from reviews.models import Product
    return Product.objects.create(name=name, sku=sku or f"SKU-{Product.objects.count() + 1:05d}")


def make_review(product, author, rating=5, text="Works as described.", state="published", created_at=None):
    from reviews.models import Review
    moment = created_at or NOW
    return Review.objects.create(product=product, author=author, rating=rating, text=text, state=state,
                                 created_at=moment, updated_at=moment)


def make_reviews(product, ratings, state="published"):
    """One review per rating in `ratings`, each by a new shopper. Returns the reviews."""
    from accounts.models import Account
    start = Account.objects.count()
    return [make_review(product, make_account(f"Shopper {start + i}"), rating=r, state=state) for i, r in enumerate(ratings)]
