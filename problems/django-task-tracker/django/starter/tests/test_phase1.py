from datetime import date

from tests.base import ApiTestCase, make_project, make_task, make_user

from board.models import Task


class ProjectAccessTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.priya, self.jonah, self.dana = make_user("priya"), make_user("jonah"), make_user("dana")
        self.web = make_project("Website relaunch", [self.priya, self.jonah])
        self.payroll = make_project("Payroll audit", [self.dana])
        self.mine = make_task(self.web, "Write the launch post", assignee=self.jonah)
        self.theirs = make_task(self.payroll, "Reconcile March")

    def test_requests_without_a_user_are_rejected(self):
        response = self.client.get("/projects/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "not_authenticated")

    def test_projects_list_only_shows_the_users_projects(self):
        self.sign_in(self.priya)
        names = [p["name"] for p in self.client.get("/projects/").json()]
        self.assertEqual(names, ["Website relaunch"])

    def test_task_list_of_a_project_the_user_is_not_in_is_404(self):
        self.sign_in(self.priya)
        response = self.client.get(f"/projects/{self.payroll.id}/tasks/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_a_member_can_read_a_task(self):
        self.sign_in(self.priya)
        response = self.client.get(f"/tasks/{self.mine.id}/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["title"], "Write the launch post")
        self.assertEqual(body["assignee"], {"id": self.jonah.id, "username": "jonah"})

    def test_reading_a_task_of_another_project_is_404(self):
        self.sign_in(self.priya)
        response = self.client.get(f"/tasks/{self.theirs.id}/")
        self.assertEqual(response.status_code, 404, response.content)
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_patching_a_task_of_another_project_is_404_and_changes_nothing(self):
        self.sign_in(self.priya)
        response = self.client.patch(f"/tasks/{self.theirs.id}/", {"title": "Hijacked"}, format="json")
        self.assertEqual(response.status_code, 404, response.content)
        self.theirs.refresh_from_db()
        self.assertEqual(self.theirs.title, "Reconcile March")

    def test_a_member_can_patch_a_task(self):
        self.sign_in(self.priya)
        response = self.client.patch(f"/tasks/{self.mine.id}/", {"priority": 3, "due_on": "2026-03-09"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["priority"], 3)
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.due_on, date(2026, 3, 9))


class TaskCreationTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.priya, self.jonah, self.dana = make_user("priya"), make_user("jonah"), make_user("dana")
        self.web = make_project("Website relaunch", [self.priya, self.jonah])
        self.sign_in(self.priya)

    def test_creating_a_task_returns_it_with_defaults(self):
        response = self.client.post(f"/projects/{self.web.id}/tasks/", {"title": "Redirect old URLs"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual((body["status"], body["priority"], body["assignee"]), ("todo", 2, None))
        self.assertEqual(body["project_id"], self.web.id)

    def test_the_assignee_must_be_a_project_member(self):
        response = self.client.post(f"/projects/{self.web.id}/tasks/", {"title": "x", "assignee_id": self.dana.id}, format="json")
        self.assertEqual(response.status_code, 400)
        error = response.json()["error"]
        self.assertEqual(error["code"], "validation_error")
        self.assertIn("assignee_id", error["fields"])
        self.assertEqual(Task.objects.count(), 0)

    def test_a_blank_title_is_rejected(self):
        response = self.client.post(f"/projects/{self.web.id}/tasks/", {"title": ""}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.json()["error"]["fields"])

    def test_the_task_list_has_a_paging_envelope(self):
        for i in range(3):
            make_task(self.web, f"Task {i}")
        body = self.client.get(f"/projects/{self.web.id}/tasks/").json()
        self.assertEqual((body["count"], body["page"], body["page_size"]), (3, 1, 20))
        self.assertEqual([t["title"] for t in body["results"]], ["Task 0", "Task 1", "Task 2"])


class DashboardTests(ApiTestCase):
    def test_dashboard_counts_statuses_assignees_and_overdue(self):
        priya, jonah = make_user("priya"), make_user("jonah")
        web = make_project("Website relaunch", [priya, jonah])
        other = make_project("Payroll audit", [priya])
        make_task(web, "a", assignee=jonah, status="todo", due_on=date(2026, 2, 27))       # overdue
        make_task(web, "b", assignee=jonah, status="in_progress", due_on=date(2026, 3, 2))  # due today: not overdue
        make_task(web, "c", assignee=priya, status="done", due_on=date(2026, 1, 5))        # done: not overdue
        make_task(web, "d", assignee=None, status="in_progress", due_on=date(2026, 3, 1))  # overdue
        make_task(web, "e", assignee=priya, status="todo")
        make_task(other, "not counted", assignee=priya, due_on=date(2026, 1, 1))
        self.sign_in(priya)
        response = self.client.get(f"/projects/{web.id}/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "project_id": web.id, "total": 5,
            "by_status": {"todo": 2, "in_progress": 2, "done": 1},
            "by_assignee": [{"assignee": {"id": jonah.id, "username": "jonah"}, "count": 2},
                            {"assignee": {"id": priya.id, "username": "priya"}, "count": 2},
                            {"assignee": None, "count": 1}],
            "overdue": 2})

    def test_dashboard_of_a_project_the_user_is_not_in_is_404(self):
        make_project("Secret", [make_user("dana")])
        self.sign_in(make_user("priya"))
        from board.models import Project
        self.assertEqual(self.client.get(f"/projects/{Project.objects.get().id}/dashboard/").status_code, 404)
