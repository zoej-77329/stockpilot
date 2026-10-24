import pytest
from decimal import Decimal
from app.extensions import db
from app.models.user import User
from app.models.category import Category
from app.models.customer import Customer
from app.models.product import Product


@pytest.fixture
def order_fixture(client, app):
    """Sets up database state for order tests."""
    with app.app_context():
        admin = User(username="admin_o", email="admin_o@test.com", role="admin")
        admin.set_password("Pass123!")
        staff = User(username="staff_o", email="staff_o@test.com", role="staff")
        staff.set_password("Pass123!")
        db.session.add_all([admin, staff])
        db.session.flush()

        cat = Category(name="Peripherals")
        db.session.add(cat)
        db.session.flush()

        customer = Customer(name="Metro Retail", email="metro@retail.com")
        db.session.add(customer)
        db.session.flush()

        # Product 1: Stock = 10, Unit Price = 25.00
        p1 = Product(
            sku="ITEM-A",
            name="Item A",
            category_id=cat.id,
            unit_price=Decimal("25.00"),
            cost_price=Decimal("12.00"),
            current_stock=10,
        )
        # Product 2: Stock = 5, Unit Price = 50.00
        p2 = Product(
            sku="ITEM-B",
            name="Item B",
            category_id=cat.id,
            unit_price=Decimal("50.00"),
            cost_price=Decimal("25.00"),
            current_stock=5,
        )
        db.session.add_all([p1, p2])
        db.session.commit()

        admin_id = admin.id
        staff_id = staff.id
        cust_id = customer.id
        p1_id = p1.id
        p2_id = p2.id

    admin_token = client.post(
        "/api/auth/login", json={"username": "admin_o", "password": "Pass123!"}
    ).get_json()["data"]["token"]

    staff_token = client.post(
        "/api/auth/login", json={"username": "staff_o", "password": "Pass123!"}
    ).get_json()["data"]["token"]

    return {
        "admin_token": admin_token,
        "staff_token": staff_token,
        "customer_id": cust_id,
        "p1_id": p1_id,
        "p2_id": p2_id,
    }


def test_order_placement_deducts_stock(client, order_fixture):
    """Test successful order checkout decrements stock and computes totals."""
    headers = {"Authorization": f"Bearer {order_fixture['staff_token']}"}

    payload = {
        "customer_id": order_fixture["customer_id"],
        "tax_rate": 0.05,
        "items": [
            {"product_id": order_fixture["p1_id"], "quantity": 4},   # 4 * 25.00 = 100.00
            {"product_id": order_fixture["p2_id"], "quantity": 2},   # 2 * 50.00 = 100.00
        ],
    }

    response = client.post("/api/orders", json=payload, headers=headers)
    assert response.status_code == 201
    order_data = response.get_json()["data"]

    # Subtotal = 200.00, Tax = 10.00 (5%), Total = 210.00
    assert order_data["subtotal"] == "200.00"
    assert order_data["tax_amount"] == "10.00"
    assert order_data["total_amount"] == "210.00"
    assert order_data["status"] == "CONFIRMED"

    # Verify inventory deductions in database
    p1_resp = client.get(f"/api/products/{order_fixture['p1_id']}", headers=headers)
    assert p1_resp.get_json()["data"]["current_stock"] == 6  # 10 - 4 = 6

    p2_resp = client.get(f"/api/products/{order_fixture['p2_id']}", headers=headers)
    assert p2_resp.get_json()["data"]["current_stock"] == 3  # 5 - 2 = 3


def test_order_insufficient_stock_rejected_with_rollback(client, order_fixture):
    """
    Test atomic rollback: If one item exceeds available inventory,
    the entire order is rejected with 409 Conflict, and no stock is deducted.
    """
    headers = {"Authorization": f"Bearer {order_fixture['staff_token']}"}

    payload = {
        "customer_id": order_fixture["customer_id"],
        "tax_rate": 0.0,
        "items": [
            {"product_id": order_fixture["p1_id"], "quantity": 2},   # available: 10 (valid)
            {"product_id": order_fixture["p2_id"], "quantity": 10},  # available: 5 (OVERSELL!)
        ],
    }

    response = client.post("/api/orders", json=payload, headers=headers)
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INSUFFICIENT_STOCK"
    assert data["error"]["sku"] == "ITEM-B"

    # CRITICAL: Verify Item A was NOT deducted (atomic rollback preserved original 10)
    p1_resp = client.get(f"/api/products/{order_fixture['p1_id']}", headers=headers)
    assert p1_resp.get_json()["data"]["current_stock"] == 10

    p2_resp = client.get(f"/api/products/{order_fixture['p2_id']}", headers=headers)
    assert p2_resp.get_json()["data"]["current_stock"] == 5


def test_order_cancellation_restores_inventory(client, order_fixture):
    """Test cancelling an order restores inventory to active stock."""
    staff_headers = {"Authorization": f"Bearer {order_fixture['staff_token']}"}
    admin_headers = {"Authorization": f"Bearer {order_fixture['admin_token']}"}

    # 1. Place order for 3 units of Item A (stock: 10 -> 7)
    order_resp = client.post(
        "/api/orders",
        json={"customer_id": order_fixture["customer_id"], "items": [{"product_id": order_fixture["p1_id"], "quantity": 3}]},
        headers=staff_headers,
    )
    assert order_resp.status_code == 201
    order_id = order_resp.get_json()["data"]["id"]

    p1_before = client.get(f"/api/products/{order_fixture['p1_id']}", headers=staff_headers)
    assert p1_before.get_json()["data"]["current_stock"] == 7

    # 2. Admin cancels order
    cancel_resp = client.put(
        f"/api/orders/{order_id}/status",
        json={"status": "CANCELLED", "reason": "Customer cancellation request"},
        headers=admin_headers,
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.get_json()["data"]["status"] == "CANCELLED"

    # 3. Verify stock restored to 10
    p1_after = client.get(f"/api/products/{order_fixture['p1_id']}", headers=staff_headers)
    assert p1_after.get_json()["data"]["current_stock"] == 10
