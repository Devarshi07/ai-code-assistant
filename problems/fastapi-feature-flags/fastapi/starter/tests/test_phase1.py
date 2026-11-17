import hashlib
import unittest

from fastapi.testclient import TestClient

from app.main import create_app


def reference_bucket(flag_key: str, user_id: str) -> int:
    """The documented bucketing rule, written independently of the code under test."""
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def user_with_bucket(flag_key: str, bucket: int) -> str:
    for i in range(100_000):
        if reference_bucket(flag_key, f"user-{i}") == bucket:
            return f"user-{i}"
    raise AssertionError("no user found")


class RolloutTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = TestClient(self.app)

    def make_flag(self, key="new-checkout", **fields):
        response = self.client.post("/flags", json={"key": key, **fields})
        self.assertEqual(response.status_code, 201, response.text)

    def check(self, key, user_id):
        response = self.client.get(f"/flags/{key}/check", params={"user_id": user_id})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def audience(self, key, users):
        """How many of ``users`` the service switches on for ``key``."""
        service = self.app.state.flags
        return sum(1 for user in users if service.check(key, user).value)

    def test_a_flag_can_be_created_and_fetched(self):
        self.make_flag(description="Redesigned checkout.", rollout_percent=10)
        body = self.client.get("/flags/new-checkout").json()
        self.assertEqual(body["key"], "new-checkout")
        self.assertEqual(body["rollout_percent"], 10)
        self.assertTrue(body["enabled"])
        self.assertFalse(body["default"])

    def test_the_same_user_always_gets_the_same_answer(self):
        self.make_flag(rollout_percent=50)
        for user in ("alice", "bob", "carol", "dave"):
            answers = {self.check("new-checkout", user)["value"] for _ in range(5)}
            self.assertEqual(len(answers), 1, f"{user} flipped between requests")

    def test_a_full_rollout_reaches_everyone(self):
        self.make_flag(rollout_percent=100)
        users = [f"user-{i}" for i in range(500)]
        self.assertEqual(self.audience("new-checkout", users), 500)
        self.assertEqual(self.check("new-checkout", users[3])["reason"], "rollout")

    def test_a_disabled_flag_is_off_even_at_full_rollout(self):
        self.make_flag(enabled=False, default=True, rollout_percent=100)
        result = self.check("new-checkout", "alice")
        self.assertEqual(result, {"key": "new-checkout", "user_id": "alice", "value": False, "reason": "disabled"})

    def test_users_outside_the_rollout_get_the_default(self):
        self.make_flag(default=True, rollout_percent=10)
        outsider = user_with_bucket("new-checkout", 50)
        result = self.check("new-checkout", outsider)
        self.assertEqual((result["value"], result["reason"]), (True, "default"))

    def test_buckets_follow_the_documented_hash(self):
        from app.services.bucketing import bucket_for

        self.assertEqual(bucket_for("new-checkout", "user-1"), 83)
        self.assertEqual(bucket_for("new-checkout", "alice"), 74)
        self.assertEqual(bucket_for("new-checkout", "bob"), 40)
        for user in ("alice", "bob", "carol"):
            self.assertTrue(0 <= bucket_for("dark-mode", user) < 100)

    def test_zero_percent_reaches_nobody(self):
        self.make_flag(rollout_percent=0)
        users = [f"user-{i}" for i in range(2000)]
        self.assertEqual(self.audience("new-checkout", users), 0)

    def test_ten_percent_reaches_exactly_the_users_in_buckets_zero_to_nine(self):
        self.make_flag(rollout_percent=10)
        users = [f"u{i}" for i in range(5000)]
        expected = sum(1 for user in users if reference_bucket("new-checkout", user) < 10)
        self.assertEqual(self.audience("new-checkout", users), expected)

    def test_the_user_on_the_boundary_bucket_stays_out(self):
        self.make_flag(rollout_percent=10)
        inside = user_with_bucket("new-checkout", 9)
        boundary = user_with_bucket("new-checkout", 10)
        self.assertEqual(self.check("new-checkout", inside)["reason"], "rollout")
        result = self.check("new-checkout", boundary)
        self.assertEqual((result["value"], result["reason"]), (False, "default"))

    def test_the_check_endpoint_describes_an_unknown_flag_as_404(self):
        response = self.client.get("/flags/nope/check", params={"user_id": "alice"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


if __name__ == "__main__":
    unittest.main()
