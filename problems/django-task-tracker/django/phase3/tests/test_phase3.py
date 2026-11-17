import random
from collections import Counter
from datetime import date, timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.base import ApiTestCase, TODAY, make_project, make_task, make_user

from board.models import Task


def seed_project(tasks=3000, people=8, seed_value=5, prefix="user"):
    """A busy project: many tasks spread over a few people, some unassigned, a mix of due dates."""
    rng = random.Random(seed_value)
    members = [make_user(f"{prefix}{i:02d}") for i in range(people)]
    project = make_project("Big launch", members)
    rows = []
    for _ in range(tasks):
        who = None if rng.random() < 0.08 else rng.choice(members)
        due = None if rng.random() < 0.2 else TODAY + timedelta(days=rng.randint(-30, 30))
        rows.append(Task(project=project, title=f"Task {len(rows)}", assignee=who,
                         status=rng.choice(Task.STATUSES), priority=rng.randint(1, 3), due_on=due))
    Task.objects.bulk_create(rows)
    return project, members, rows


class DashboardBudgetTests(ApiTestCase):
    def test_dashboard_stays_within_a_small_query_budget(self):
        project, members, _ = seed_project()
        self.sign_in(members[0])
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(f"/projects/{project.id}/dashboard/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertLessEqual(len(queries), 4, f"the dashboard ran {len(queries)} queries for 3000 tasks")

    def test_dashboard_cost_does_not_grow_with_the_number_of_people(self):
        small, members, _ = seed_project(tasks=60, people=2)
        self.sign_in(members[0])
        with CaptureQueriesContext(connection) as few:
            self.client.get(f"/projects/{small.id}/dashboard/")
        big, members, _ = seed_project(tasks=600, people=12, seed_value=6, prefix="big")
        self.sign_in(members[0])
        with CaptureQueriesContext(connection) as many:
            self.client.get(f"/projects/{big.id}/dashboard/")
        self.assertEqual(len(few), len(many), f"2 people took {len(few)} queries but 12 took {len(many)}")

    def test_dashboard_numbers_match_the_data(self):
        project, members, rows = seed_project(tasks=1500, seed_value=9)
        other, _, _ = seed_project(tasks=100, people=3, seed_value=10, prefix="other")
        self.sign_in(members[0])
        body = self.client.get(f"/projects/{project.id}/dashboard/").json()
        by_status = Counter(t.status for t in rows)
        self.assertEqual(body["total"], 1500)
        self.assertEqual(body["by_status"], {s: by_status[s] for s in Task.STATUSES})
        self.assertEqual(body["overdue"], sum(1 for t in rows if t.is_overdue(TODAY)))
        counts = Counter(t.assignee_id for t in rows)
        expected = [{"assignee": {"id": m.id, "username": m.username}, "count": counts[m.id]}
                    for m in sorted(members, key=lambda m: m.username) if counts[m.id]]
        if counts[None]:
            expected.append({"assignee": None, "count": counts[None]})
        self.assertEqual(body["by_assignee"], expected)

    def test_dashboard_edge_cases(self):
        priya = make_user("priya")
        empty = make_project("Empty", [priya])
        self.sign_in(priya)
        self.assertEqual(self.client.get(f"/projects/{empty.id}/dashboard/").json(), {
            "project_id": empty.id, "total": 0, "by_status": {"todo": 0, "in_progress": 0, "done": 0},
            "by_assignee": [], "overdue": 0})
        make_task(empty, "due today", due_on=date(2026, 3, 2))
        make_task(empty, "done and late", status="done", due_on=date(2026, 1, 1))
        make_task(empty, "late", status="in_progress", due_on=date(2026, 3, 1))
        self.assertEqual(self.client.get(f"/projects/{empty.id}/dashboard/").json()["overdue"], 1)


class ListBudgetTests(ApiTestCase):
    def fetch(self, project, **params):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(f"/projects/{project.id}/tasks/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return len(queries), response.json()

    def test_listing_a_full_page_does_not_query_per_assignee(self):
        project, members, _ = seed_project()
        self.sign_in(members[0])
        count, body = self.fetch(project, page_size=100)
        self.assertEqual(len(body["results"]), 100)
        self.assertTrue(all(t["assignee"] is None or t["assignee"]["username"].startswith("user") for t in body["results"]))
        self.assertLessEqual(count, 3, f"listing 100 tasks ran {count} queries")

    def test_list_cost_does_not_depend_on_the_page_size(self):
        project, members, _ = seed_project(tasks=400)
        self.sign_in(members[0])
        small, _ = self.fetch(project, page_size=5)
        large, _ = self.fetch(project, page_size=100)
        self.assertEqual(small, large, f"5 tasks took {small} queries but 100 took {large}")

    def test_filtered_and_ordered_lists_stay_within_budget_and_stay_correct(self):
        project, members, rows = seed_project(tasks=500, seed_value=3)
        self.sign_in(members[0])
        count, body = self.fetch(project, status="todo", overdue="true", ordering="-priority", page_size=50)
        expected = sorted((t for t in Task.objects.filter(project=project, status="todo") if t.is_overdue(TODAY)),
                          key=lambda t: (-t.priority, t.id))
        self.assertEqual(body["count"], len(expected))
        self.assertEqual([t["id"] for t in body["results"]], [t.id for t in expected[:50]])
        self.assertLessEqual(count, 3)

    def test_assignee_data_is_still_shown(self):
        priya, jonah = make_user("priya"), make_user("jonah")
        web = make_project("Website relaunch", [priya, jonah])
        make_task(web, "one", assignee=jonah)
        make_task(web, "two")
        self.sign_in(priya)
        _, body = self.fetch(web)
        self.assertEqual([t["assignee"] for t in body["results"]], [{"id": jonah.id, "username": "jonah"}, None])
