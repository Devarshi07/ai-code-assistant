import random
import time
import unittest

from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import MovementCreate, ProductCreate, Warehouse

N_PRODUCTS = 20_000
WAREHOUSE_IDS = [f"WHS-{n}" for n in range(1, 7)]
CATEGORIES = ["tea", "coffee", "kitchen", "snacks", "gifts", "cleaning"]
ROUNDS = 200
LIMIT_SECONDS = 0.6


class LowStockReportAtScaleTests(unittest.TestCase):
    """A catalogue the size of the real one, seeded through the service."""

    @classmethod
    def setUpClass(cls):
        rng = random.Random(4417)
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.service = cls.app.state.inventory
        for wid in WAREHOUSE_IDS:
            cls.service.create_warehouse(Warehouse(id=wid, name=f"Site {wid}", city="Springfield"))
        # Our own ledger of the expected state, independent of the service.
        cls.products = {}
        cls.stock = {}
        for i in range(N_PRODUCTS):
            sku = f"SKU-{i:05d}"
            reorder = rng.randint(5, 40)
            active = rng.random() > 0.03
            category = rng.choice(CATEGORIES)
            cls.service.create_product(ProductCreate(sku=sku, name=f"Item {i}", category=category,
                                                     price_cents=rng.randint(100, 9000), reorder_level=reorder,
                                                     active=active))
            cls.products[sku] = {"category": category, "reorder": reorder, "active": active}
            total = rng.randint(0, reorder - 1) if rng.random() < 0.01 else reorder + rng.randint(3, 60)
            if total:
                sites = rng.sample(WAREHOUSE_IDS, 2)
                first = rng.randint(0, total)
                for wid, qty in ((sites[0], first), (sites[1], total - first)):
                    if qty:
                        cls.service.record_movement(MovementCreate(warehouse_id=wid, sku=sku, kind="receive", quantity=qty))
                        cls.stock[(wid, sku)] = cls.stock.get((wid, sku), 0) + qty

    def expected(self, category=None):
        totals = self.totals()
        rows = []
        for sku, p in self.products.items():
            on_hand = totals.get(sku, 0)
            if p["active"] and on_hand < p["reorder"] and (category is None or p["category"] == category):
                rows.append((p["reorder"] - on_hand, sku, on_hand))
        rows.sort(key=lambda r: (-r[0], r[1]))
        return rows

    def check_report(self, report, category=None, limit=50):
        rows = self.expected(category)
        self.assertEqual(report["total"], len(rows))
        self.assertEqual([(i["shortfall"], i["sku"], i["on_hand"]) for i in report["items"]], rows[:limit])

    def ship(self, rng):
        wid, sku = rng.choice(self.stocked)
        qty = self.stock[(wid, sku)]
        if qty == 0:
            return
        amount = min(qty, rng.randint(1, 8))
        self.service.record_movement(MovementCreate(warehouse_id=wid, sku=sku, kind="ship", quantity=amount))
        self.stock[(wid, sku)] = qty - amount

    def test_1_report_matches_the_catalogue(self):
        self.check_report(self.client.get("/reports/low-stock").json())
        self.check_report(self.client.get("/reports/low-stock", params={"category": "tea", "limit": 7}).json(), "tea", 7)
        self.check_report(self.client.get("/reports/low-stock", params={"limit": 500}).json(), limit=500)

    def test_2_report_stays_fast_while_stock_moves(self):
        rng = random.Random(90)
        self.__class__.stocked = sorted(key for key, qty in self.stock.items() if qty)
        started = time.perf_counter()
        for n in range(ROUNDS):
            for _ in range(3):
                self.ship(rng)
            report = self.service.low_stock_report(category=CATEGORIES[n % len(CATEGORIES)] if n % 3 == 0 else None)
        elapsed = time.perf_counter() - started
        self.assertLess(elapsed, LIMIT_SECONDS,
                        f"{ROUNDS} dashboard refreshes took {elapsed:.2f}s; must be under {LIMIT_SECONDS}s")
        self.assertIsNotNone(report)
        self.check_report(self.service.low_stock_report(limit=500).model_dump(), limit=500)
        self.check_report(self.client.get("/reports/low-stock", params={"category": "snacks"}).json(), "snacks")

    def totals(self):
        totals = {}
        for (wid, sku), qty in self.stock.items():
            totals[sku] = totals.get(sku, 0) + qty
        return totals

    def test_3_reorder_level_and_discontinuing_update_the_report(self):
        totals = self.totals()
        sku = next(s for s, p in sorted(self.products.items()) if p["active"] and totals.get(s, 0) >= 30)
        on_hand = totals[sku]
        response = self.client.patch(f"/products/{sku}", json={"reorder_level": on_hand + 25})
        self.assertEqual(response.status_code, 200, response.text)
        self.products[sku]["reorder"] = on_hand + 25
        report = self.client.get("/reports/low-stock", params={"limit": 500}).json()
        self.assertIn(sku, [i["sku"] for i in report["items"]], "raising the reorder level should list the product")
        self.check_report(report, limit=500)

        self.client.patch(f"/products/{sku}", json={"active": False})
        self.products[sku]["active"] = False
        report = self.client.get("/reports/low-stock", params={"limit": 500}).json()
        self.assertNotIn(sku, [i["sku"] for i in report["items"]], "discontinued products are not reordered")
        self.check_report(report, limit=500)

    def test_4_transfers_keep_the_report_correct(self):
        # A low-stock product that still has some stock: move all of it to another site.
        sku = next(sku for shortfall, sku, on_hand in self.expected() if on_hand > 0)
        wid = next(w for w in WAREHOUSE_IDS if self.stock.get((w, sku), 0) > 0)
        other = next(w for w in WAREHOUSE_IDS if w != wid)
        qty = self.stock[(wid, sku)]
        response = self.client.post("/transfers", json={"sku": sku, "from_warehouse": wid, "to_warehouse": other, "quantity": qty})
        self.assertEqual(response.status_code, 201, response.text)
        self.stock[(wid, sku)] = 0
        self.stock[(other, sku)] = self.stock.get((other, sku), 0) + qty
        self.check_report(self.client.get("/reports/low-stock").json())


class IdempotentTransferTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        for wid in ("BOS-1", "DEN-1"):
            self.client.post("/warehouses", json={"id": wid, "name": wid, "city": "x"})
        self.client.post("/products", json={"sku": "MUG-STONE-12", "name": "Stoneware mug", "category": "kitchen",
                                            "price_cents": 1600, "reorder_level": 10})
        self.client.post("/movements", json={"warehouse_id": "BOS-1", "sku": "MUG-STONE-12", "kind": "receive", "quantity": 40})
        self.body = {"sku": "MUG-STONE-12", "from_warehouse": "BOS-1", "to_warehouse": "DEN-1", "quantity": 15}

    def transfer(self, key=None, **overrides):
        headers = {"Idempotency-Key": key} if key else {}
        return self.client.post("/transfers", json={**self.body, **overrides}, headers=headers)

    def levels(self):
        return self.client.get("/products/MUG-STONE-12/stock").json()["by_warehouse"]

    def test_a_retried_transfer_moves_stock_once(self):
        first = self.transfer("retry-7f3a")
        second = self.transfer("retry-7f3a")
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(second.status_code, 201, second.text)
        self.assertEqual(second.json(), first.json(), "a retry returns the original transfer")
        self.assertEqual(self.levels(), {"BOS-1": 25, "DEN-1": 15})
        movements = self.client.get("/products/MUG-STONE-12/movements").json()
        self.assertEqual(len([m for m in movements if m["kind"].startswith("transfer")]), 2)

    def test_reusing_a_key_for_a_different_transfer_is_a_conflict(self):
        self.assertEqual(self.transfer("order-1").status_code, 201)
        response = self.transfer("order-1", quantity=5)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "idempotency_conflict")
        self.assertEqual(self.levels(), {"BOS-1": 25, "DEN-1": 15})

    def test_different_keys_and_no_key_are_separate_transfers(self):
        ids = {self.transfer("a", quantity=5).json()["id"], self.transfer("b", quantity=5).json()["id"],
               self.transfer(quantity=5).json()["id"], self.transfer(quantity=5).json()["id"]}
        self.assertEqual(len(ids), 4)
        self.assertEqual(self.levels(), {"BOS-1": 20, "DEN-1": 20})

    def test_validation_and_stock_rules_still_apply(self):
        self.assertEqual(self.transfer("big", quantity=41).status_code, 409)
        self.assertEqual(self.transfer("zero", quantity=0).status_code, 422)
        self.assertEqual(self.levels(), {"BOS-1": 40, "DEN-1": 0})


if __name__ == "__main__":
    unittest.main()
