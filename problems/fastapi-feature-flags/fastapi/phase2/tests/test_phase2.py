import hashlib
import unittest

from fastapi.testclient import TestClient

from app.main import create_app


def reference_bucket(flag_key: str, user_id: str) -> int:
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def user_with_bucket(flag_key: str, bucket: int) -> str:
    for i in range(100_000):
        if reference_bucket(flag_key, f"user-{i}") == bucket:
            return f"user-{i}"
    raise AssertionError("no user found")


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = TestClient(self.app)

    def make_flag(self, key, **fields):
        response = self.client.post("/flags", json={"key": key, **fields})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def evaluate(self, user_id="u-1", **attributes):
        response = self.client.post("/evaluate", json={"user_id": user_id, "attributes": attributes})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["flags"]

    def assertInvalid(self, response, *fields):
        self.assertEqual(response.status_code, 422, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "validation_error")
        for field in fields:
            self.assertIn(field, error["fields"], f"{field} missing from {error['fields']}")


class EvaluateEndpointTests(ApiTestCase):
    def test_returns_every_flag_ordered_by_key_with_a_reason(self):
        self.make_flag("zeta")
        self.make_flag("alpha", default=True)
        self.make_flag("mid", enabled=False)
        response = self.client.post("/evaluate", json={"user_id": "u-1"})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["user_id"], "u-1")
        self.assertEqual(list(body["flags"]), ["alpha", "mid", "zeta"])
        self.assertEqual(body["flags"]["alpha"], {"value": True, "reason": "default"})
        self.assertEqual(body["flags"]["mid"], {"value": False, "reason": "disabled"})
        self.assertEqual(body["flags"]["zeta"], {"value": False, "reason": "default"})

    def test_no_flags_gives_an_empty_object(self):
        self.assertEqual(self.client.post("/evaluate", json={"user_id": "u-1"}).json(), {"user_id": "u-1", "flags": {}})

    def test_a_matching_rule_decides_the_value(self):
        self.make_flag("checkout", rules=[{"when": 'country == "DE"'}])
        self.assertEqual(self.evaluate(country="DE")["checkout"], {"value": True, "reason": "rule"})
        self.assertEqual(self.evaluate(country="FR")["checkout"], {"value": False, "reason": "default"})
        self.assertEqual(self.evaluate()["checkout"], {"value": False, "reason": "default"})

    def test_a_rule_can_switch_a_flag_off(self):
        self.make_flag("search", default=True, rules=[{"when": 'plan == "free"', "value": False}])
        self.assertEqual(self.evaluate(plan="free")["search"], {"value": False, "reason": "rule"})
        self.assertEqual(self.evaluate(plan="pro")["search"], {"value": True, "reason": "default"})

    def test_the_first_matching_rule_wins(self):
        self.make_flag("f", rules=[
            {"when": 'country == "DE"', "value": False},
            {"when": 'plan in ["pro", "team"]', "value": True},
        ])
        self.assertEqual(self.evaluate(country="DE", plan="pro")["f"], {"value": False, "reason": "rule"})
        self.assertEqual(self.evaluate(country="FR", plan="pro")["f"], {"value": True, "reason": "rule"})

    def test_rules_beat_the_rollout_and_the_rollout_beats_the_default(self):
        self.make_flag("f", rollout_percent=100, rules=[{"when": 'country == "US"', "value": False}])
        self.assertEqual(self.evaluate(country="US")["f"], {"value": False, "reason": "rule"})
        self.assertEqual(self.evaluate(country="DE")["f"], {"value": True, "reason": "rollout"})

    def test_a_disabled_flag_ignores_rules_and_rollout(self):
        self.make_flag("f", enabled=False, default=True, rollout_percent=100, rules=[{"when": 'country == "DE"'}])
        self.assertEqual(self.evaluate(country="DE")["f"], {"value": False, "reason": "disabled"})

    def test_rollout_uses_the_stable_bucket_for_each_flag(self):
        self.make_flag("alpha", rollout_percent=30)
        self.make_flag("beta", rollout_percent=30)
        for user in ("u-1", "u-2", "u-3", "u-4", "u-5", "u-6"):
            flags = self.evaluate(user)
            for key in ("alpha", "beta"):
                inside = reference_bucket(key, user) < 30
                self.assertEqual(flags[key], {"value": inside, "reason": "rollout" if inside else "default"})

    def test_user_id_can_be_targeted(self):
        self.make_flag("f", rules=[{"when": 'user_id in ["vip-1", "vip-2"]'}])
        self.assertEqual(self.evaluate("vip-2")["f"]["reason"], "rule")
        self.assertEqual(self.evaluate("vip-3")["f"]["reason"], "default")

    def test_an_attribute_called_user_id_cannot_override_the_real_one(self):
        self.make_flag("f", rules=[{"when": 'user_id == "vip-1"'}])
        response = self.client.post("/evaluate", json={"user_id": "someone", "attributes": {"user_id": "vip-1"}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["flags"]["f"]["reason"], "default")

    def test_numeric_comparisons(self):
        self.make_flag("adult", rules=[{"when": "age >= 18"}])
        self.make_flag("young", rules=[{"when": "age < 18"}])
        self.assertEqual(self.evaluate(age=18)["adult"]["reason"], "rule")
        self.assertEqual(self.evaluate(age=17.5)["young"]["reason"], "rule")
        self.assertEqual(self.evaluate(age=17)["adult"]["reason"], "default")
        self.assertEqual(self.evaluate(age="21")["adult"]["reason"], "default")
        self.assertEqual(self.evaluate()["young"]["reason"], "default")

    def test_a_missing_attribute_never_matches_not_equal_or_not_in(self):
        self.make_flag("a", rules=[{"when": 'country != "DE"'}])
        self.make_flag("b", rules=[{"when": 'plan not in ["free"]'}])
        flags = self.evaluate()
        self.assertEqual(flags["a"]["reason"], "default")
        self.assertEqual(flags["b"]["reason"], "default")
        flags = self.evaluate(country="FR", plan="pro")
        self.assertEqual(flags["a"]["reason"], "rule")
        self.assertEqual(flags["b"]["reason"], "rule")
        self.assertEqual(self.evaluate(country="DE", plan="free")["a"]["reason"], "default")

    def test_values_of_different_kinds_are_not_equal(self):
        self.make_flag("one", rules=[{"when": "level == 1"}])
        self.make_flag("flag", rules=[{"when": "beta == true"}])
        self.assertEqual(self.evaluate(level=1)["one"]["reason"], "rule")
        self.assertEqual(self.evaluate(level=1.0)["one"]["reason"], "rule")
        self.assertEqual(self.evaluate(level="1")["one"]["reason"], "default")
        self.assertEqual(self.evaluate(level=True)["one"]["reason"], "default")
        self.assertEqual(self.evaluate(beta=True)["flag"]["reason"], "rule")
        self.assertEqual(self.evaluate(beta=1)["flag"]["reason"], "default")

    def test_the_rollout_boundary_follows_the_documented_buckets(self):
        self.make_flag("f", rollout_percent=10)
        self.assertEqual(self.evaluate(user_with_bucket("f", 9))["f"]["reason"], "rollout")
        self.assertEqual(self.evaluate(user_with_bucket("f", 10))["f"]["reason"], "default")

    def test_evaluate_requests_are_validated(self):
        self.assertInvalid(self.client.post("/evaluate", json={}), "body.user_id")
        self.assertInvalid(self.client.post("/evaluate", json={"user_id": ""}), "body.user_id")
        response = self.client.post("/evaluate", json={"user_id": "u", "attributes": {"country": ["DE"]}})
        self.assertEqual(response.status_code, 422, response.text)
        self.assertTrue(any(name.startswith("body.attributes") for name in response.json()["error"]["fields"]))

    def test_flag_changes_show_up_in_the_next_evaluation(self):
        self.make_flag("f", rules=[{"when": 'country == "DE"'}])
        self.assertEqual(self.evaluate(country="DE")["f"]["reason"], "rule")
        self.assertEqual(self.client.patch("/flags/f", json={"rules": [{"when": 'country == "FR"'}]}).status_code, 200)
        self.assertEqual(self.evaluate(country="DE")["f"]["reason"], "default")
        self.assertEqual(self.evaluate(country="FR")["f"]["reason"], "rule")
        self.client.delete("/flags/f")
        self.assertEqual(self.evaluate(country="FR"), {})


class FlagCrudTests(ApiTestCase):
    def test_a_duplicate_key_is_a_409_and_changes_nothing(self):
        self.make_flag("dark-mode", description="original", default=True)
        response = self.client.post("/flags", json={"key": "dark-mode", "description": "replacement"})
        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "duplicate_flag")
        self.assertEqual(error["details"], {"key": "dark-mode"})
        flag = self.client.get("/flags/dark-mode").json()
        self.assertEqual((flag["description"], flag["default"]), ("original", True))

    def test_unknown_flags_are_404_for_every_method(self):
        for response in (
            self.client.get("/flags/ghost"),
            self.client.patch("/flags/ghost", json={"enabled": False}),
            self.client.delete("/flags/ghost"),
            self.client.get("/flags/ghost/check", params={"user_id": "u"}),
        ):
            self.assertEqual(response.status_code, 404, response.text)
            self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_deleting_removes_the_flag(self):
        self.make_flag("temp")
        self.assertEqual(self.client.delete("/flags/temp").status_code, 204)
        self.assertEqual(self.client.get("/flags/temp").status_code, 404)
        self.assertEqual(self.client.delete("/flags/temp").status_code, 404)
        self.make_flag("temp")

    def test_invalid_keys_are_rejected(self):
        for key in ("", "Dark-Mode", "1st", "has space", "x" * 49, "under_score!"):
            self.assertInvalid(self.client.post("/flags", json={"key": key}), "body.key")
        self.assertInvalid(self.client.post("/flags", json={}), "body.key")
        self.assertEqual(self.client.get("/flags").json(), [])

    def test_valid_keys_are_accepted(self):
        for key in ("a", "new-checkout", "beta_2", "x" * 48):
            self.make_flag(key)

    def test_rollout_percent_must_be_a_whole_number_from_0_to_100(self):
        for value in (-1, 101, 12.5, "ten", None):
            self.assertInvalid(self.client.post("/flags", json={"key": "f", "rollout_percent": value}),
                               "body.rollout_percent")
        self.make_flag("low", rollout_percent=0)
        self.make_flag("high", rollout_percent=100)

    def test_booleans_must_be_booleans(self):
        self.assertInvalid(self.client.post("/flags", json={"key": "f", "enabled": "yes"}), "body.enabled")
        self.assertInvalid(self.client.post("/flags", json={"key": "f", "default": 1}), "body.default")

    def test_rules_are_validated_and_the_error_names_the_bad_rule(self):
        bad = ['country = "DE"', "country ==", 'plan in "pro"', "age >= old", "== 5", 'plan in []',
               'country in["DE"]', "age > true", "x == NaN"]
        for expression in bad:
            response = self.client.post("/flags", json={"key": "f", "rules": [{"when": 'a == 1'}, {"when": expression}]})
            self.assertInvalid(response, "body.rules.1.when")
        self.assertInvalid(self.client.post("/flags", json={"key": "f", "rules": [{"when": "a == 1", "value": "no"}]}),
                           "body.rules.0.value")
        self.assertInvalid(self.client.post("/flags", json={"key": "f", "rules": [{"when": "a == 1"}] * 21}), "body.rules")
        self.assertEqual(self.client.get("/flags/f").status_code, 404)

    def test_valid_rule_expressions_are_accepted(self):
        good = ['country == "DE"', 'country!="DE"', 'plan in ["pro", "team"]', 'plan not in ["free"]', "age>=18",
                "age < 65.5", "beta == true", "  level   ==   3  "]
        flag = self.make_flag("f", rules=[{"when": expression} for expression in good])
        self.assertEqual(len(flag["rules"]), len(good))
        self.assertEqual(flag["rules"][0], {"when": 'country == "DE"', "value": True})

    def test_description_is_limited(self):
        self.assertInvalid(self.client.post("/flags", json={"key": "f", "description": "x" * 201}), "body.description")
        self.make_flag("g", description="x" * 200)

    def test_patch_is_validated_like_create(self):
        self.make_flag("f", description="keep", default=True)
        self.assertInvalid(self.client.patch("/flags/f", json={"rollout_percent": 101}), "body.rollout_percent")
        self.assertInvalid(self.client.patch("/flags/f", json={"rules": [{"when": "nonsense"}]}), "body.rules.0.when")
        self.assertInvalid(self.client.patch("/flags/f", json={"enabled": None}), "body.enabled")
        self.assertInvalid(self.client.patch("/flags/f", json={"description": None}), "body.description")
        self.assertInvalid(self.client.patch("/flags/f", json={"key": "renamed"}), "body.key")
        flag = self.client.get("/flags/f").json()
        self.assertEqual((flag["description"], flag["default"], flag["enabled"]), ("keep", True, True))

    def test_patch_changes_only_the_fields_that_were_sent(self):
        self.make_flag("f", description="keep", default=True, rollout_percent=20, rules=[{"when": "a == 1"}])
        response = self.client.patch("/flags/f", json={"enabled": False})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "key": "f", "description": "keep", "enabled": False, "default": True,
            "rollout_percent": 20, "rules": [{"when": "a == 1", "value": True}],
        })
        self.assertEqual(self.client.patch("/flags/f", json={"rules": []}).json()["rules"], [])

    def test_list_is_sorted_by_key(self):
        for key in ("b", "c", "a"):
            self.make_flag(key)
        self.assertEqual([f["key"] for f in self.client.get("/flags").json()], ["a", "b", "c"])


if __name__ == "__main__":
    unittest.main()
