"""A day on the Website relaunch board, run through the API's test client."""
import logging
import os
from datetime import date
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
# 4xx answers are part of the story here; keep Django's request warnings out of the output.
logging.getLogger("django.request").setLevel(logging.ERROR)

from django.contrib.auth import get_user_model  # noqa: E402
from django.core.management import call_command  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from board.models import Project  # noqa: E402

call_command("migrate", run_syncdb=True, verbosity=0)
MORNING = date(2026, 3, 2)


def show(label, response):
    body = response.json()
    if isinstance(body, dict) and "error" in body:
        print(f"  {label}: {response.status_code} {body['error']['code']} - {body['error']['message']}")
    else:
        print(f"  {label}: {response.status_code}")
    return body


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def main():
    User = get_user_model()
    priya, jonah, dana = (User.objects.create(username=name) for name in ("priya", "jonah", "dana"))
    project = Project.objects.create(name="Website relaunch")
    project.members.add(priya, jonah)
    other = Project.objects.create(name="Payroll audit")
    other.members.add(dana)

    print(f"Board opens on {MORNING}")
    with mock.patch("board.clock.today", return_value=MORNING):
        api = client_for(priya)
        seed = [("Write the launch post", jonah, 2, "2026-03-05"), ("Redirect old URLs", priya, 3, "2026-02-27"),
                ("Compress hero images", jonah, 1, None), ("Book the press call", None, 2, "2026-03-20")]
        tasks = [api.post(f"/projects/{project.id}/tasks/",
                          {"title": t, "assignee_id": who.id if who else None, "priority": p, "due_on": due},
                          format="json").json() for t, who, p, due in seed]
        print("\nBoard")
        for item in api.get(f"/projects/{project.id}/tasks/").json()["results"]:
            who = item["assignee"]["username"] if item["assignee"] else "nobody"
            print(f"  #{item['id']} {item['title']:<24} {item['status']:<12} p{item['priority']}  {who}  due {item['due_on'] or '-'}")

        print("\nSomeone from another project pokes around")
        outsider = client_for(dana)
        show("Dana reads a task", outsider.get(f"/tasks/{tasks[0]['id']}/"))
        show("Dana edits a task", outsider.patch(f"/tasks/{tasks[0]['id']}/", {"title": "Hacked"}, format="json"))

        print("\nMoving work along")
        show("Start the launch post", client_for(jonah).post(f"/tasks/{tasks[0]['id']}/transition/", {"status": "in_progress"}, format="json"))
        show("Skip straight to done", client_for(jonah).post(f"/tasks/{tasks[1]['id']}/transition/", {"status": "done"}, format="json"))

        board = api.get(f"/projects/{project.id}/dashboard/").json()
        print(f"\nDashboard: {board['total']} tasks, {board['overdue']} overdue")
        print("  by status:", ", ".join(f"{k}={v}" for k, v in board["by_status"].items()))
        for row in board["by_assignee"]:
            print(f"  {row['assignee']['username'] if row['assignee'] else 'unassigned'}: {row['count']}")


if __name__ == "__main__":
    main()
