import hashlib
import random
import unittest

from fastapi.testclient import TestClient

from app.main import create_app
from app.rules import set_parse_hook
from app.schemas import FlagCreate

N_FLAGS = 200
N_USERS = 250  # 200 flags x 250 users = 50,000 evaluations
COUNTRIES = ["DE", "FR", "US", "BR", "JP", "IN"]
PLANS = ["free", "pro", "team", "enterprise"]


def reference_bucket(flag_key: str, user_id: str) -> int:
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def make_rule(rng: random.Random):
    """A rule expression, the value it serves, and an independent predicate for it."""
    kind = rng.choice(["country_eq", "country_ne", "plan_in", "age_ge", "user_in"])
    value = rng.random() < 0.7
    if kind == "country_eq":
        country = rng.choice(COUNTRIES)
        return f'country == "{country}"', value, lambda f: f.get("country") == country
    if kind == "country_ne":
        country = rng.choice(COUNTRIES)
        return f'country != "{country}"', value, lambda f: "country" in f and f["country"] != country
    if kind == "plan_in":
        plans = rng.sample(PLANS, 2)
        return f"plan in {plans}".replace("'", '"'), value, lambda f: f.get("plan") in plans
    if kind == "age_ge":
        age = rng.randint(16, 60)
        return f"age >= {age}", value, lambda f: isinstance(f.get("age"), int) and f["age"] >= age
    ids = [f"user-{rng.randrange(N_USERS):04d}" for _ in range(8)]
    return "user_id in " + str(ids).replace("'", '"'), value, lambda f: f["user_id"] in ids


class FlagsAtScaleTests(unittest.TestCase):
    """200 flags and 250 users, with expectations computed outside the service."""

    @classmethod
    def setUpClass(cls):
        rng = random.Random(2718)
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.service = cls.app.state.flags
        cls.flags = []
        for i in range(N_FLAGS):
            rules = [make_rule(rng) for _ in range(rng.randint(0, 4))]
            flag = {
                "key": f"flag-{i:03d}",
                "enabled": rng.random() < 0.9,
                "default": rng.random() < 0.3,
                "rollout_percent": rng.choice([0, 0, 5, 10, 25, 50, 90, 100]),
                "rules": [{"when": expr, "value": value} for expr, value, _ in rules],
            }
            cls.service.create_flag(FlagCreate.model_validate(flag))
            cls.flags.append((flag, [(pred, value) for _, value, pred in rules]))
        cls.total_rules = sum(len(flag["rules"]) for flag, _ in cls.flags)
        cls.users = []
        for i in range(N_USERS):
            attributes = {}
            if rng.random() < 0.85:
                attributes["country"] = rng.choice(COUNTRIES)
            if rng.random() < 0.8:
                attributes["plan"] = rng.choice(PLANS)
            if rng.random() < 0.7:
                attributes["age"] = rng.randint(14, 70)
            cls.users.append((f"user-{i:04d}", attributes))

    def tearDown(self):
        set_parse_hook(None)

    def expected(self, user_id, attributes):
        facts = {**attributes, "user_id": user_id}
        result = {}
        for flag, rules in self.flags:
            if not flag["enabled"]:
                result[flag["key"]] = (False, "disabled")
                continue
            for predicate, value in rules:
                if predicate(facts):
                    result[flag["key"]] = (value, "rule")
                    break
            else:
                if reference_bucket(flag["key"], user_id) < flag["rollout_percent"]:
                    result[flag["key"]] = (True, "rollout")
                else:
                    result[flag["key"]] = (flag["default"], "default")
        return result

    def test_fifty_thousand_evaluations_are_exact(self):
        for user_id, attributes in self.users:
            got = {key: (e.value, e.reason) for key, e in self.service.evaluate(user_id, attributes).items()}
            self.assertEqual(got, self.expected(user_id, attributes), f"mismatch for {user_id}")

    def test_evaluating_never_reparses_rules(self):
        parsed = []
        set_parse_hook(parsed.append)
        for user_id, attributes in self.users:
            self.service.evaluate(user_id, attributes)
        self.assertGreater(self.total_rules, 200)
        self.assertLessEqual(
            len(parsed), self.total_rules,
            f"{len(parsed)} rule parses for {N_FLAGS * N_USERS} evaluations of {self.total_rules} rules; "
            "compile each flag's rules once, when the flag changes",
        )

    def test_the_http_endpoint_agrees_with_the_service(self):
        for user_id, attributes in self.users[:5]:
            response = self.client.post("/evaluate", json={"user_id": user_id, "attributes": attributes})
            self.assertEqual(response.status_code, 200, response.text)
            got = {key: (r["value"], r["reason"]) for key, r in response.json()["flags"].items()}
            self.assertEqual(got, self.expected(user_id, attributes))


class CompiledRulesStayCurrentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())

    def tearDown(self):
        set_parse_hook(None)

    def evaluate(self, user_id="u-1", **attributes):
        response = self.client.post("/evaluate", json={"user_id": user_id, "attributes": attributes})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["flags"]

    def test_changing_rules_changes_the_evaluation(self):
        self.client.post("/flags", json={"key": "f", "rules": [{"when": 'country == "DE"'}]})
        self.assertEqual(self.evaluate(country="DE")["f"]["reason"], "rule")
        self.client.patch("/flags/f", json={"rules": [{"when": 'country == "FR"', "value": False}], "default": True})
        self.assertEqual(self.evaluate(country="DE")["f"], {"value": True, "reason": "default"})
        self.assertEqual(self.evaluate(country="FR")["f"], {"value": False, "reason": "rule"})

    def test_other_changes_keep_the_rules_working(self):
        self.client.post("/flags", json={"key": "f", "rules": [{"when": "age >= 18"}]})
        self.client.patch("/flags/f", json={"enabled": False})
        self.assertEqual(self.evaluate(age=30)["f"], {"value": False, "reason": "disabled"})
        self.client.patch("/flags/f", json={"enabled": True, "description": "back on"})
        self.assertEqual(self.evaluate(age=30)["f"], {"value": True, "reason": "rule"})
        self.client.patch("/flags/f", json={"rollout_percent": 100})
        self.assertEqual(self.evaluate(age=10)["f"], {"value": True, "reason": "rollout"})

    def test_a_flag_change_parses_only_that_flags_rules(self):
        for i in range(30):
            self.client.post("/flags", json={"key": f"f-{i:02d}", "rules": [{"when": f"age >= {i}"}, {"when": "plan == \"pro\""}]})
        parsed = []
        set_parse_hook(parsed.append)
        self.assertEqual(self.client.patch("/flags/f-07", json={"description": "touched"}).status_code, 200)
        self.assertEqual(self.client.patch("/flags/f-08", json={"rules": [{"when": "age >= 1"}, {"when": "age >= 2"}]}).status_code, 200)
        self.assertLessEqual(len(parsed), 8, f"{len(parsed)} parses for two single-flag edits")
        self.assertEqual(self.evaluate(age=2, plan="free")["f-08"]["reason"], "rule")
        self.assertEqual(self.evaluate(age=1, plan="free")["f-08"]["reason"], "rule")
        self.assertEqual(self.evaluate(age=0, plan="free")["f-08"]["reason"], "default")

    def test_deleted_and_recreated_flags_use_the_new_rules(self):
        self.client.post("/flags", json={"key": "f", "rules": [{"when": 'plan == "pro"'}]})
        self.client.delete("/flags/f")
        self.client.post("/flags", json={"key": "f", "rules": [{"when": 'plan == "team"'}]})
        self.assertEqual(self.evaluate(plan="pro")["f"]["reason"], "default")
        self.assertEqual(self.evaluate(plan="team")["f"]["reason"], "rule")


class ETagTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        for key in ("alpha", "beta", "gamma"):
            response = self.client.post("/flags", json={"key": key, "rules": [{"when": 'plan == "pro"'}]})
            self.assertEqual(response.status_code, 201, response.text)

    def test_list_responses_carry_an_etag(self):
        response = self.client.get("/flags")
        self.assertEqual(response.status_code, 200)
        etag = response.headers.get("etag")
        self.assertTrue(etag and etag.startswith('"') and etag.endswith('"'), f"bad ETag {etag!r}")
        self.assertEqual(self.client.get("/flags").headers["etag"], etag)
        self.assertEqual([flag["key"] for flag in response.json()], ["alpha", "beta", "gamma"])

    def test_an_unchanged_list_returns_304_with_no_body(self):
        etag = self.client.get("/flags").headers["etag"]
        response = self.client.get("/flags", headers={"If-None-Match": etag})
        self.assertEqual(response.status_code, 304)
        self.assertEqual(response.content, b"")
        self.assertEqual(response.headers["etag"], etag)

    def test_any_change_to_the_flag_set_changes_the_etag(self):
        before = self.client.get("/flags").headers["etag"]
        changes = [
            lambda: self.client.patch("/flags/beta", json={"enabled": False}),
            lambda: self.client.patch("/flags/beta", json={"rollout_percent": 5}),
            lambda: self.client.patch("/flags/beta", json={"rules": [{"when": 'plan == "team"'}]}),
            lambda: self.client.post("/flags", json={"key": "delta"}),
            lambda: self.client.delete("/flags/alpha"),
        ]
        seen = {before}
        for change in changes:
            self.assertIn(change().status_code, (200, 201, 204))
            response = self.client.get("/flags", headers={"If-None-Match": before})
            self.assertEqual(response.status_code, 200, "a stale ETag must not give a 304")
            etag = response.headers["etag"]
            self.assertNotIn(etag, seen, "ETag did not change after an edit")
            seen.add(etag)
            before = etag
            self.assertEqual(self.client.get("/flags", headers={"If-None-Match": etag}).status_code, 304)

    def test_single_flags_have_their_own_etags(self):
        first = self.client.get("/flags/alpha")
        self.assertEqual(first.status_code, 200)
        etag = first.headers["etag"]
        self.assertNotEqual(etag, self.client.get("/flags/beta").headers["etag"])
        self.client.patch("/flags/beta", json={"description": "changed"})
        self.assertEqual(self.client.get("/flags/alpha", headers={"If-None-Match": etag}).status_code, 304)
        self.client.patch("/flags/alpha", json={"default": True})
        response = self.client.get("/flags/alpha", headers={"If-None-Match": etag})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["default"])
        self.assertNotEqual(response.headers["etag"], etag)

    def test_if_none_match_accepts_lists_weak_tags_and_a_star(self):
        etag = self.client.get("/flags").headers["etag"]
        for header in (f'"other", {etag}', f"W/{etag}", "*", f'  {etag}  '):
            response = self.client.get("/flags", headers={"If-None-Match": header})
            self.assertEqual(response.status_code, 304, header)
        self.assertEqual(self.client.get("/flags", headers={"If-None-Match": '"nope"'}).status_code, 200)

    def test_errors_are_not_turned_into_304s(self):
        response = self.client.get("/flags/ghost", headers={"If-None-Match": "*"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


if __name__ == "__main__":
    unittest.main()
