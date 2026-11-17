from datetime import date

from tests.base import ApiTestCase, make_project, make_task, make_user

from board.models import Task


class TransitionTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.priya, self.jonah, self.dana = make_user("priya"), make_user("jonah"), make_user("dana")
        self.web = make_project("Website relaunch", [self.priya, self.jonah])
        self.task = make_task(self.web, "Write the launch post", assignee=self.jonah)
        self.sign_in(self.priya)

    def move(self, to, task=None, **extra):
        return self.client.post(f"/tasks/{(task or self.task).id}/transition/", {"status": to, **extra}, format="json")

    def test_the_happy_path_walks_todo_to_in_progress_to_done(self):
        first = self.move("in_progress")
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(first.json()["status"], "in_progress")
        self.assertEqual(first.json()["assignee"], {"id": self.jonah.id, "username": "jonah"})
        second = self.move("done")
        self.assertEqual((second.status_code, second.json()["status"]), (200, "done"))
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "done")

    def test_an_in_progress_task_can_go_back_to_todo(self):
        self.move("in_progress")
        self.assertEqual(self.move("todo").json()["status"], "todo")

    def test_skipping_a_step_is_a_409_with_the_documented_body(self):
        response = self.move("done")
        self.assertEqual(response.status_code, 409, response.content)
        error = response.json()["error"]
        self.assertEqual(error["code"], "invalid_transition")
        self.assertEqual((error["from"], error["to"], error["allowed"]), ("todo", "done", ["in_progress"]))
        self.assertIn("message", error)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "todo")

    def test_moving_to_the_current_status_is_a_409(self):
        response = self.move("todo")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["allowed"], ["in_progress"])

    def test_a_done_task_cannot_go_straight_back_to_todo(self):
        done = make_task(self.web, "Shipped", status="done")
        response = self.move("todo", done, reason="oops")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["allowed"], ["in_progress"])

    def test_reopening_a_done_task_needs_a_reason(self):
        done = make_task(self.web, "Shipped", status="done")
        for extra in ({}, {"reason": ""}, {"reason": "   "}):
            response = self.move("in_progress", done, **extra)
            self.assertEqual(response.status_code, 400, extra)
            error = response.json()["error"]
            self.assertEqual(error["code"], "validation_error")
            self.assertIn("reason", error["fields"])
        done.refresh_from_db()
        self.assertEqual(done.status, "done")

    def test_reopening_with_a_reason_stores_it(self):
        done = make_task(self.web, "Shipped", status="done")
        response = self.move("in_progress", done, reason="  Broken on Safari ")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "in_progress")
        self.assertEqual(response.json()["reopen_reason"], "Broken on Safari")
        done.refresh_from_db()
        self.assertEqual(done.reopen_reason, "Broken on Safari")

    def test_other_moves_do_not_need_a_reason(self):
        self.assertEqual(self.move("in_progress").status_code, 200)

    def test_an_unknown_status_is_a_validation_error(self):
        response = self.move("blocked")
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["error"]["fields"])
        self.assertEqual(self.client.post(f"/tasks/{self.task.id}/transition/", {}, format="json").status_code, 400)

    def test_a_task_in_another_project_is_a_404(self):
        theirs = make_task(make_project("Payroll audit", [self.dana]), "Reconcile March")
        response = self.move("in_progress", theirs)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")
        theirs.refresh_from_db()
        self.assertEqual(theirs.status, "todo")

    def test_an_unknown_task_is_a_404(self):
        self.assertEqual(self.client.post("/tasks/9999/transition/", {"status": "in_progress"}, format="json").status_code, 404)

    def test_patch_still_cannot_change_the_status(self):
        self.client.patch(f"/tasks/{self.task.id}/", {"title": "Renamed", "status": "done"}, format="json")
        self.task.refresh_from_db()
        self.assertEqual((self.task.title, self.task.status), ("Renamed", "todo"))


class ListQueryTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.priya, self.jonah = make_user("priya"), make_user("jonah")
        self.web = make_project("Website relaunch", [self.priya, self.jonah])
        # id order: a b c d e f
        self.a = make_task(self.web, "a", status="todo", priority=2, assignee=self.jonah, due_on=date(2026, 2, 27))
        self.b = make_task(self.web, "b", status="in_progress", priority=3, assignee=self.priya, due_on=date(2026, 3, 2))
        self.c = make_task(self.web, "c", status="done", priority=1, assignee=self.jonah, due_on=date(2026, 1, 5))
        self.d = make_task(self.web, "d", status="todo", priority=3, assignee=None, due_on=None)
        self.e = make_task(self.web, "e", status="in_progress", priority=2, assignee=self.jonah, due_on=date(2026, 3, 20))
        self.f = make_task(self.web, "f", status="todo", priority=3, assignee=self.priya, due_on=date(2026, 3, 1))
        make_task(make_project("Other", [self.priya]), "elsewhere", status="todo", due_on=date(2020, 1, 1))
        self.sign_in(self.priya)

    def titles(self, **params):
        response = self.client.get(f"/projects/{self.web.id}/tasks/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return [t["title"] for t in response.json()["results"]]

    def test_filter_by_status(self):
        self.assertEqual(self.titles(status="todo"), ["a", "d", "f"])
        self.assertEqual(self.titles(status="done"), ["c"])

    def test_filter_by_assignee(self):
        self.assertEqual(self.titles(assignee=self.jonah.id), ["a", "c", "e"])
        self.assertEqual(self.titles(assignee=99999), [])

    def test_overdue_true_keeps_only_unfinished_tasks_past_due(self):
        self.assertEqual(self.titles(overdue="true"), ["a", "f"])

    def test_overdue_false_keeps_everything_else_including_tasks_without_a_due_date(self):
        self.assertEqual(self.titles(overdue="false"), ["b", "c", "d", "e"])

    def test_omitting_overdue_does_not_filter(self):
        self.assertEqual(self.titles(), ["a", "b", "c", "d", "e", "f"])

    def test_filters_combine(self):
        self.assertEqual(self.titles(status="todo", overdue="true", assignee=self.priya.id), ["f"])
        self.assertEqual(self.titles(status="in_progress", assignee=self.jonah.id), ["e"])

    def test_ordering_by_due_date_puts_missing_dates_last(self):
        self.assertEqual(self.titles(ordering="due_on"), ["c", "a", "f", "b", "e", "d"])
        self.assertEqual(self.titles(ordering="-due_on"), ["e", "b", "f", "a", "c", "d"])

    def test_ordering_by_priority_breaks_ties_by_id(self):
        self.assertEqual(self.titles(ordering="-priority"), ["b", "d", "f", "a", "e", "c"])
        self.assertEqual(self.titles(ordering="priority"), ["c", "a", "e", "b", "d", "f"])

    def test_pagination_slices_the_ordered_filtered_list(self):
        response = self.client.get(f"/projects/{self.web.id}/tasks/", {"ordering": "-priority", "page_size": 4, "page": 2})
        body = response.json()
        self.assertEqual((body["count"], body["page"], body["page_size"]), (6, 2, 4))
        self.assertEqual([t["title"] for t in body["results"]], ["e", "c"])
        body = self.client.get(f"/projects/{self.web.id}/tasks/", {"status": "todo", "page_size": 2}).json()
        self.assertEqual((body["count"], [t["title"] for t in body["results"]]), (3, ["a", "d"]))

    def test_a_page_past_the_end_is_empty_but_still_200(self):
        body = self.client.get(f"/projects/{self.web.id}/tasks/", {"page": 9}).json()
        self.assertEqual((body["count"], body["results"]), (6, []))

    def test_the_default_page_size_is_twenty(self):
        for i in range(25):
            make_task(self.web, f"extra {i}")
        body = self.client.get(f"/projects/{self.web.id}/tasks/").json()
        self.assertEqual((body["count"], body["page_size"], len(body["results"])), (31, 20, 20))

    def test_bad_query_parameters_are_validation_errors(self):
        bad = {"status": "blocked", "assignee": "bob", "overdue": "maybe", "ordering": "title",
               "page": 0, "page_size": 101}
        for name, value in bad.items():
            response = self.client.get(f"/projects/{self.web.id}/tasks/", {name: value})
            self.assertEqual(response.status_code, 400, f"{name}={value}")
            error = response.json()["error"]
            self.assertEqual(error["code"], "validation_error")
            self.assertIn(name, error["fields"])

    def test_the_list_still_hides_other_projects(self):
        other = make_project("Payroll audit", [make_user("dana")])
        self.assertEqual(self.client.get(f"/projects/{other.id}/tasks/", {"status": "todo"}).status_code, 404)
