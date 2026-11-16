import unittest

from fastapi.testclient import TestClient

from app.main import create_app

KETTLE = {
    "sku": "KETTLE-GOOSE",
    "name": "Gooseneck kettle",
    "category": "kitchen",
    "price_cents": 5900,
    "reorder_level": 8,
    "description": "1 litre, stovetop.",
}


class ProductUpdateTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        response = self.client.post("/products", json=KETTLE)
        self.assertEqual(response.status_code, 201, response.text)

    def test_create_and_fetch_product(self):
        response = self.client.get("/products/KETTLE-GOOSE")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {**KETTLE, "active": True})

    def test_changing_the_price_keeps_every_other_field(self):
        response = self.client.patch("/products/KETTLE-GOOSE", json={"price_cents": 5400})
        self.assertEqual(response.status_code, 200, response.text)
        expected = {**KETTLE, "price_cents": 5400, "active": True}
        self.assertEqual(response.json(), expected)
        self.assertEqual(self.client.get("/products/KETTLE-GOOSE").json(), expected)

    def test_renaming_a_discontinued_product_keeps_it_discontinued(self):
        self.assertEqual(self.client.patch("/products/KETTLE-GOOSE", json={"active": False}).status_code, 200)
        response = self.client.patch("/products/KETTLE-GOOSE", json={"name": "Gooseneck kettle (old model)"})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["name"], "Gooseneck kettle (old model)")
        self.assertFalse(body["active"], "a rename must not reactivate a discontinued product")
        self.assertEqual(body["reorder_level"], 8)

    def test_description_can_be_cleared_with_null(self):
        response = self.client.patch("/products/KETTLE-GOOSE", json={"description": None})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["description"])
        self.assertEqual(response.json()["price_cents"], 5900)

    def test_changing_the_reorder_level_takes_effect(self):
        response = self.client.patch("/products/KETTLE-GOOSE", json={"reorder_level": 12})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["reorder_level"], 12)

    def test_invalid_price_is_a_validation_error(self):
        response = self.client.patch("/products/KETTLE-GOOSE", json={"price_cents": -1})
        self.assertEqual(response.status_code, 422)
        error = response.json()["error"]
        self.assertEqual(error["code"], "validation_error")
        self.assertIn("body.price_cents", error["fields"])

    def test_name_cannot_be_null(self):
        response = self.client.patch("/products/KETTLE-GOOSE", json={"name": None})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    def test_unknown_product_is_404(self):
        response = self.client.patch("/products/NOPE-123", json={"price_cents": 100})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class StockMovementTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        self.client.post("/products", json=KETTLE)
        self.client.post("/warehouses", json={"id": "CHI-2", "name": "Chicago West", "city": "Chicago"})

    def move(self, kind, quantity):
        return self.client.post("/movements", json={"warehouse_id": "CHI-2", "sku": "KETTLE-GOOSE",
                                                    "kind": kind, "quantity": quantity})

    def test_receive_then_ship(self):
        self.assertEqual(self.move("receive", 10).json()["on_hand"], 10)
        response = self.move("ship", 4)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["on_hand"], 6)
        stock = self.client.get("/products/KETTLE-GOOSE/stock").json()
        self.assertEqual(stock, {"sku": "KETTLE-GOOSE", "on_hand": 6, "by_warehouse": {"CHI-2": 6}})

    def test_shipping_more_than_available_is_a_conflict(self):
        self.move("receive", 3)
        response = self.move("ship", 5)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], {
            "code": "insufficient_stock",
            "message": "Only 3 of 'KETTLE-GOOSE' in CHI-2.",
            "details": {"available": 3, "requested": 5},
        })

    def test_quantity_must_be_positive(self):
        response = self.move("receive", 0)
        self.assertEqual(response.status_code, 422)
        self.assertIn("body.quantity", response.json()["error"]["fields"])


if __name__ == "__main__":
    unittest.main()
