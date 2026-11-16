"""A morning at the Shelfwise front desk, run through the API's test client."""
import logging
import os
from datetime import date, timedelta
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
# 4xx answers are part of the story here; keep Django's request warnings out of the output.
logging.getLogger("django.request").setLevel(logging.ERROR)

from django.core.management import call_command  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

call_command("migrate", run_syncdb=True, verbosity=0)
client = APIClient()
MORNING = date(2026, 3, 2)


def show(label, response):
    body = response.json()
    if isinstance(body, dict) and "error" in body:
        print(f"  {label}: {response.status_code} {body['error']['code']} - {body['error']['message']}")
    else:
        print(f"  {label}: {response.status_code}")
    return body


def on(day):
    return mock.patch("library.clock.today", return_value=day)


def main():
    books = [client.post("/books/", b, format="json").json() for b in (
        {"title": "The Salt Road Atlas", "author": "Mira Okafor", "isbn": "978-0000000001", "copies": 1},
        {"title": "Small Engines of the Sea", "author": "Tomas Reyes", "isbn": "978-0000000002", "copies": 2},
    )]
    members = [client.post("/members/", m, format="json").json() for m in (
        {"name": "Priya Raman", "email": "priya@example.org", "joined_on": "2025-09-01"},
        {"name": "Jonah Bell", "email": "jonah@example.org", "joined_on": "2026-01-12"},
    )]
    atlas, engines = books
    priya, jonah = members

    print(f"Desk opens on {MORNING}")
    with on(MORNING):
        loan = show("Priya borrows the atlas", client.post("/loans/", {"member_id": priya["id"], "book_id": atlas["id"]}, format="json"))
        print(f"    due back {loan['due_on']}")
        show("Jonah asks for the same atlas", client.post("/loans/", {"member_id": jonah["id"], "book_id": atlas["id"]}, format="json"))
        show("Jonah borrows Small Engines", client.post("/loans/", {"member_id": jonah["id"], "book_id": engines["id"]}, format="json"))

    print("\nCatalogue")
    for book in client.get("/books/").json():
        print(f"  {book['title']:<26} {book['available']}/{book['copies']} on the shelf")

    late = MORNING + timedelta(days=19)
    print(f"\nPriya brings the atlas back on {late}")
    with on(late):
        back = show("Return", client.post(f"/loans/{loan['id']}/return/", format="json"))
        print(f"    fine ${back['fine_cents'] / 100:.2f}")
        fines = client.get(f"/members/{jonah['id']}/fines/").json()
        print(f"  Jonah owes ${fines['total_cents'] / 100:.2f} so far")
        for item in fines["items"]:
            print(f"    {item['title']}: {item['days_late']} days late, ${item['fine_cents'] / 100:.2f}{' (still out)' if item['accruing'] else ''}")
        overdue = client.get("/loans/", {"status": "overdue"}).json()
        print(f"  Overdue now: {', '.join(l['book']['title'] + ' (' + l['member']['name'] + ')' for l in overdue) or 'none'}")


if __name__ == "__main__":
    main()
