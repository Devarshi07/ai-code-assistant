import unittest

from fastapi.testclient import TestClient

from app.main import create_app

WAREHOUSES = [("BOS-1", "Boston Docks", "Boston"), ("CHI-2", "Chicago West", "Chicago"), ("DEN-1", "Denver Hub", "Denver")]

PRODUCTS = [
    # sku, name, category, price_cents
    ("TEA-EARL-250", "Earl Grey, 250 g", "tea", 899),
    ("TEA-SENCHA-100", "Sencha, 100 g", "tea", 1250),
    ("TEA-ASSAM-500", "assam breakfast, 500 g", "tea", 1250),
    ("MUG-STONE-12", "Stoneware mug, 12 oz", "kitchen", 1600),
    ("KETTLE-GOOSE", "Gooseneck kettle", "kitchen", 5900),
    ("FILTER-PAPER-100", "Paper filters, 100 pack", "coffee", 450),
    ("BEANS-HOUSE-1K", "House blend beans, 1 kg", "coffee", 2400),
    ("TEA-POT-CAST", "Cast iron teapot", "kitchen", 4500),
]

RECEIPTS = [("BOS-1", "TEA-EARL-250", 30), ("CHI-2", "TEA-EARL-250", 18), ("DEN-1", "TEA-SENCHA-100", 12),
            ("BOS-1", "MUG-STONE-12", 45), ("CHI-2", "KETTLE-GOOSE", 3), ("BOS-1", "BEANS-HOUSE-1K", 14),
            ("CHI-2", "TEA-POT-CAST", 2)]


def build_client():
    client = TestClient(create_app())
    for wid, name, city in WAREHOUSES:
        assert client.post("/warehouses", json={"id": wid, "name": name, "city": city}).status_code == 201
    for sku, name, category, price in PRODUCTS:
        body = {"sku": sku, "name": name, "category": category, "price_cents": price, "reorder_level": 5}
        assert client.post("/products", json=body).status_code == 201
    for wid, sku, qty in RECEIPTS:
        body = {"warehouse_id": wid, "sku": sku, "kind": "receive", "quantity": qty}
        assert client.post("/movements", json=body).status_code == 201
    return client


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.client = build_client()

    def transfer(self, **overrides):
        body = {"sku": "TEA-EARL-250", "from_warehouse": "BOS-1", "to_warehouse": "DEN-1", "quantity": 12}
        body.update(overrides)
        return self.client.post("/transfers", json=body)

    def test_transfer_moves_stock_and_reports_both_levels(self):
        response = self.transfer()
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertTrue(body["id"].startswith("TR-"))
        for key, value in {"sku": "TEA-EARL-250", "from_warehouse": "BOS-1", "to_warehouse": "DEN-1",
                           "quantity": 12, "from_on_hand": 18, "to_on_hand": 12}.items():
            self.assertEqual(body[key], value, key)
        stock = self.client.get("/products/TEA-EARL-250/stock").json()
        self.assertEqual(stock["by_warehouse"], {"BOS-1": 18, "CHI-2": 18, "DEN-1": 12})
        self.assertEqual(stock["on_hand"], 48, "a transfer must not change the total")

    def test_transfer_writes_a_movement_on_each_side(self):
        transfer_id = self.transfer(quantity=5).json()["id"]
        movements = [m for m in self.client.get("/products/TEA-EARL-250/movements").json() if m["reference"] == transfer_id]
        self.assertEqual([(m["kind"], m["warehouse_id"], m["quantity"]) for m in movements],
                         [("transfer_out", "BOS-1", 5), ("transfer_in", "DEN-1", 5)])

    def test_transfer_of_more_than_available_is_rejected_without_side_effects(self):
        response = self.transfer(quantity=31)
        self.assertEqual(response.status_code, 409)
        error = response.json()["error"]
        self.assertEqual(error["code"], "insufficient_stock")
        self.assertEqual(error["details"], {"available": 30, "requested": 31})
        stock = self.client.get("/products/TEA-EARL-250/stock").json()
        self.assertEqual(stock["by_warehouse"]["BOS-1"], 30)
        self.assertEqual(stock["by_warehouse"]["DEN-1"], 0)

    def test_transfer_to_the_same_warehouse_is_a_bad_request(self):
        response = self.transfer(to_warehouse="BOS-1")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "same_warehouse")

    def test_unknown_product_or_warehouse_is_404(self):
        for overrides in ({"sku": "NOPE-1"}, {"from_warehouse": "XXX-9"}, {"to_warehouse": "XXX-9"}):
            with self.subTest(**overrides):
                response = self.transfer(**overrides)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_quantity_must_be_positive(self):
        response = self.transfer(quantity=0)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertIn("body.quantity", response.json()["error"]["fields"])


class SearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = build_client()

    def search(self, **params):
        response = self.client.get("/products/search", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def skus(self, **params):
        return [item["sku"] for item in self.search(**params)["items"]]

    def test_default_is_by_name_case_insensitive_first_page(self):
        body = self.search()
        self.assertEqual(body["page"], 1)
        self.assertEqual(body["page_size"], 20)
        self.assertEqual(body["total"], len(PRODUCTS))
        self.assertEqual([i["sku"] for i in body["items"]], [
            "TEA-ASSAM-500", "TEA-POT-CAST", "TEA-EARL-250", "KETTLE-GOOSE",
            "BEANS-HOUSE-1K", "FILTER-PAPER-100", "TEA-SENCHA-100", "MUG-STONE-12"])

    def test_items_carry_total_stock(self):
        items = {i["sku"]: i for i in self.search()["items"]}
        self.assertEqual(items["TEA-EARL-250"], {"sku": "TEA-EARL-250", "name": "Earl Grey, 250 g",
                                                 "category": "tea", "price_cents": 899, "on_hand": 48})
        self.assertEqual(items["FILTER-PAPER-100"]["on_hand"], 0)

    def test_text_query_matches_name_or_sku_ignoring_case(self):
        self.assertEqual(self.skus(q="TEA"), ["TEA-ASSAM-500", "TEA-POT-CAST", "TEA-EARL-250", "TEA-SENCHA-100"])
        self.assertEqual(self.skus(q="teapot"), ["TEA-POT-CAST"])
        self.assertEqual(self.skus(q="pot"), ["TEA-POT-CAST"])
        self.assertEqual(self.skus(q="filters"), ["FILTER-PAPER-100"])

    def test_filters_combine(self):
        self.assertEqual(self.skus(category="kitchen", min_price=2000), ["TEA-POT-CAST", "KETTLE-GOOSE"])
        self.assertEqual(self.skus(category="tea", max_price=1250, in_stock="true"), ["TEA-EARL-250", "TEA-SENCHA-100"])
        self.assertEqual(self.skus(in_stock="false"), ["TEA-ASSAM-500", "FILTER-PAPER-100"])
        self.assertEqual(self.skus(min_price=1250, max_price=1250), ["TEA-ASSAM-500", "TEA-SENCHA-100"])

    def test_sorting_breaks_ties_by_sku(self):
        self.assertEqual(self.skus(category="tea", sort="price"), ["TEA-EARL-250", "TEA-ASSAM-500", "TEA-SENCHA-100"])
        self.assertEqual(self.skus(category="tea", sort="-price"), ["TEA-ASSAM-500", "TEA-SENCHA-100", "TEA-EARL-250"])
        self.assertEqual(self.skus(sort="-stock")[:3], ["TEA-EARL-250", "MUG-STONE-12", "BEANS-HOUSE-1K"])
        self.assertEqual(self.skus(sort="stock")[:2], ["FILTER-PAPER-100", "TEA-ASSAM-500"])
        self.assertEqual(self.skus(category="coffee", sort="-name"), ["FILTER-PAPER-100", "BEANS-HOUSE-1K"])

    def test_pagination(self):
        first = self.search(page_size=3, sort="price")
        second = self.search(page_size=3, page=2, sort="price")
        last = self.search(page_size=3, page=3, sort="price")
        self.assertEqual([i["sku"] for i in first["items"]], ["FILTER-PAPER-100", "TEA-EARL-250", "TEA-ASSAM-500"])
        self.assertEqual([i["sku"] for i in second["items"]], ["TEA-SENCHA-100", "MUG-STONE-12", "BEANS-HOUSE-1K"])
        self.assertEqual([i["sku"] for i in last["items"]], ["TEA-POT-CAST", "KETTLE-GOOSE"])
        self.assertEqual((last["page"], last["page_size"], last["total"]), (3, 3, 8))
        beyond = self.search(page_size=3, page=9)
        self.assertEqual((beyond["items"], beyond["total"]), ([], 8))

    def test_invalid_parameters_use_the_error_format(self):
        cases = [({"sort": "colour"}, "query.sort"), ({"page": 0}, "query.page"),
                 ({"page_size": 101}, "query.page_size"), ({"min_price": -5}, "query.min_price")]
        for params, field in cases:
            with self.subTest(**params):
                response = self.client.get("/products/search", params=params)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["error"]["code"], "validation_error")
                self.assertIn(field, response.json()["error"]["fields"])
        response = self.client.get("/products/search", params={"min_price": 900, "max_price": 100})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "invalid_range")

    def test_product_routes_still_work(self):
        self.assertEqual(self.client.get("/products/KETTLE-GOOSE").status_code, 200)
        self.assertEqual(self.client.get("/products/NOPE-1").status_code, 404)


if __name__ == "__main__":
    unittest.main()
