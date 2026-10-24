import pytest
from decimal import Decimal
from app.extensions import db
from app.models.user import User
from app.models.category import Category
from app.models.supplier import Supplier
from app.models.product import Product


@pytest.fixture
def stock_fixture(client, app):
    """Sets up users, category, supplier, and initial product for stock tests."""
    with app.app_context():
        admin = User(username="admin_s", email="admin_s@test.com", role="admin")
        admin.set_password("Pass123!")
        staff = User(username="staff_s", email="staff_s@test.com", role="staff")
        staff.set_password("Pass123!")
        db.session.add_all([admin, staff])
        db.session.flush()

        category = Category(name="Storage", description="Storage devices")
        db.session.add(category)
        db.session.flush()

        supplier = Supplier(name="Tech Distributors Inc", email="tech@test.com")
        db.session.add(supplier)
        db.session.flush()

        product = Product(
            sku="SSD-500GB",
            name="500GB NVMe SSD",
            category_id=category.id,
            unit_price=Decimal("69.99"),
            cost_price=Decimal("40.00"),
            current_stock=20,
            low_stock_threshold=10,
        )
        db.session.add(product)
        db.session.commit()

        admin_id = admin.id
        staff_id = staff.id
        supplier_id = supplier.id
        product_id = product.id

    admin_token = client.post(
        "/api/auth/login", json={"username": "admin_s", "password": "Pass123!"}
    ).get_json()["data"]["token"]

    staff_token = client.post(
        "/api/auth/login", json={"username": "staff_s", "password": "Pass123!"}
    ).get_json()["data"]["token"]

    return {
        "admin_token": admin_token,
        "staff_token": staff_token,
        "admin_id": admin_id,
        "staff_id": staff_id,
        "supplier_id": supplier_id,
        "product_id": product_id,
    }


def test_inbound_stock_receipt_increments_stock(client, stock_fixture):
    """Test receiving goods increments product stock and creates ledger records."""
    headers = {"Authorization": f"Bearer {stock_fixture['staff_token']}"}

    payload = {
        "supplier_id": stock_fixture["supplier_id"],
        "notes": "Restock batch Q4",
        "items": [
            {
                "product_id": stock_fixture["product_id"],
                "quantity": 30,
                "unit_cost": "38.50",
            }
        ],
    }

    response = client.post("/api/stock/receipts", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert "receipt_number" in data
    assert len(data["items"]) == 1

    # Check updated stock in database (20 + 30 = 50)
    prod_resp = client.get(f"/api/products/{stock_fixture['product_id']}", headers=headers)
    assert prod_resp.get_json()["data"]["current_stock"] == 50


def test_stock_adjustment_positive(client, stock_fixture):
    """Test positive stock adjustment for count reconciliation."""
    headers = {"Authorization": f"Bearer {stock_fixture['admin_token']}"}

    payload = {
        "product_id": stock_fixture["product_id"],
        "reason": "PHYSICAL_COUNT_RECONCILIATION",
        "quantity_delta": 5,
        "notes": "Found extra unit in shelf B",
    }

    response = client.post("/api/stock/adjustments", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["previous_stock"] == 20
    assert data["new_stock"] == 25

    # Check product stock
    prod_resp = client.get(f"/api/products/{stock_fixture['product_id']}", headers=headers)
    assert prod_resp.get_json()["data"]["current_stock"] == 25


def test_stock_adjustment_negative_below_zero_rejected(client, stock_fixture):
    """Test that an adjustment reducing stock below zero is rejected with 422."""
    headers = {"Authorization": f"Bearer {stock_fixture['admin_token']}"}

    # Current stock is 20, attempt reducing by 25
    payload = {
        "product_id": stock_fixture["product_id"],
        "reason": "DAMAGED",
        "quantity_delta": -25,
        "notes": "Water damage incident",
    }

    response = client.post("/api/stock/adjustments", json=payload, headers=headers)
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INSUFFICIENT_STOCK"

    # Verify stock remained untouched at 20
    prod_resp = client.get(f"/api/products/{stock_fixture['product_id']}", headers=headers)
    assert prod_resp.get_json()["data"]["current_stock"] == 20


def test_staff_cannot_perform_adjustment(client, stock_fixture):
    """Test RBAC: Staff cannot adjust stock (Admin only)."""
    headers = {"Authorization": f"Bearer {stock_fixture['staff_token']}"}

    payload = {
        "product_id": stock_fixture["product_id"],
        "reason": "DAMAGED",
        "quantity_delta": -1,
    }

    response = client.post("/api/stock/adjustments", json=payload, headers=headers)
    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "FORBIDDEN"
