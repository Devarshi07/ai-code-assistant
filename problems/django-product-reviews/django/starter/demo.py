"""A week of reviews on Marketlane, run through the API's test client."""
import logging
import os
from datetime import datetime, timedelta, timezone
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
# 4xx answers are part of the story here; keep Django's request warnings out of the output.
logging.getLogger("django.request").setLevel(logging.ERROR)

from django.core.management import call_command  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from accounts.models import Account  # noqa: E402

call_command("migrate", run_syncdb=True, verbosity=0)
client = APIClient()
MONDAY = datetime(2026, 3, 2, 9, 0, tzinfo=timezone.utc)


def account(name, role="shopper"):
    slug = name.lower().replace(" ", ".")
    return Account.objects.create(name=name, email=f"{slug}@example.org", role=role, api_key=f"key-{slug}")


def call(who, method, url, body=None):
    client.credentials(**({"HTTP_X_API_KEY": who.api_key} if who else {}))
    response = getattr(client, method)(url, body, format="json")
    data = response.json() if response.content else None
    if isinstance(data, dict) and "error" in data:
        print(f"    {method.upper()} {url}: {response.status_code} {data['error']['code']} - {data['error']['message']}")
    return response, data


def main():
    mod = account("Mo Derator", "moderator")
    ann, bo, cy, di = (account(n) for n in ("Ann Lee", "Bo Kim", "Cy Ortiz", "Di Novak"))
    mug = call(mod, "post", "/products/", {"name": "Trail Mug", "sku": "MUG-001"})[1]
    lamp = call(mod, "post", "/products/", {"name": "Camp Lamp", "sku": "LAMP-02"})[1]

    print("Monday: reviews arrive")
    for step, (who, product, rating, text) in enumerate([
        (ann, mug, 5, "Keeps coffee hot for hours."),
        (bo, mug, 4, "Sturdy, a little heavy."),
        (cy, mug, 2, "The handle got hot."),
        (di, mug, 1, "BUY CHEAP WATCHES AT EXAMPLE.COM"),
        (ann, lamp, 4, "Bright and light."),
    ]):
        with mock.patch("reviews.clock.now", return_value=MONDAY + timedelta(hours=step)):
            response, _ = call(who, "post", f"/products/{product['id']}/reviews/", {"rating": rating, "text": text})
        print(f"  {who.name} rates {product['name']} {rating}/5: {response.status_code}")
    print("  Ann tries to review the mug again:")
    call(ann, "post", f"/products/{mug['id']}/reviews/", {"rating": 1, "text": "Changed my mind."})

    print("\nHelpful votes")
    reviews = call(None, "get", f"/products/{mug['id']}/reviews/?sort=recent")[1]["results"]
    by_author = {r["author"]["name"]: r for r in reviews}
    for voter in (bo, cy, di):
        call(voter, "post", f"/reviews/{by_author['Ann Lee']['id']}/helpful/")
    call(ann, "post", f"/reviews/{by_author['Ann Lee']['id']}/helpful/")
    call(cy, "post", f"/reviews/{by_author['Bo Kim']['id']}/helpful/")

    print("\nThe mug's reviews, most helpful first")
    for review in call(None, "get", f"/products/{mug['id']}/reviews/?sort=helpful")[1]["results"]:
        print(f"  {review['rating']}/5 {review['author']['name']:<9} {review['helpful_count']} helpful  {review['text']}")

    print("\nA moderator hides the spam, Cy edits their review")
    call(mod, "post", f"/reviews/{by_author['Di Novak']['id']}/moderate/", {"state": "hidden"})
    call(cy, "patch", f"/reviews/{by_author['Cy Ortiz']['id']}/", {"rating": 3})
    call(bo, "patch", f"/reviews/{by_author['Cy Ortiz']['id']}/", {"rating": 5})

    print("\nCatalogue")
    for product in call(None, "get", "/products/")[1]["results"]:
        print(f"  {product['name']:<10} {product['average_rating']} stars from {product['review_count']} reviews")


if __name__ == "__main__":
    main()
