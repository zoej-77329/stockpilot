import pytest
from app.extensions import db
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.stock_movement import StockMovement


@pytest.fixture
def auth_tokens(client, app):
    """Provides JWT tokens for both admin and staff users."""
    with app.app_context():
        admin = User(username="admin_p", email="admin_p@test.com", role="admin")
        admin.set_password("Pass123!")
        staff = User(username="staff_p", email="staff_p@test.com", role="staff")
        staff.set_password("Pass123!")
        db.session.add_all([admin, staff])
        db.session.commit()

        admin_id = admin.id
        staff_id = staff.id

    admin_resp = client.post("/api/auth/login", json={"username": "admin_p", "password": "Pass123!"})
    admin_token = admin_resp.get_json()["data"]["token"]

    staff_resp = client.post("/api/auth/login", json={"username": "staff_p", "password": "Pass123!"})
    staff_token = staff_resp.get_json()["data"]["token"]

    return {"admin": admin_token, "staff": staff_token, "admin_id": admin_id, "staff_id": staff_id}


@pytest.fixture
def sample_category(app):
    """Provides a sample category."""
    with app.app_context():
        cat = Category(name="Electronics", description="Test category")
        db.session.add(cat)
        db.session.commit()
        return cat.id


def test_create_product_admin_success(client, auth_tokens, sample_category):
    """Test that an Admin can create a product and initial stock is logged."""
    payload = {
        "sku": "TEST-SKU-001",
        "name": "Test Wireless Mouse",
        "description": "Ergonomic 2.4G mouse",
        "category_id": sample_category,
        "unit_price": "29.99",
        "cost_price": "15.00",
        "initial_stock": 50,
        "low_stock_threshold": 10,
    }

    response = client.post(
        "/api/products",
        json=payload,
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["sku"] == "TEST-SKU-001"
    assert data["current_stock"] == 50

    # Verify movement ledger entry was created for initial stock
    movements_resp = client.get(
        f"/api/stock/movements?product_id={data['id']}",
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert movements_resp.status_code == 200
    movements = movements_resp.get_json()["data"]
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "RECEIPT"
    assert movements[0]["quantity_delta"] == 50


def test_create_product_duplicate_sku_rejected(client, auth_tokens, sample_category):
    """Test business invariant: duplicate SKUs must be rejected with 409 Conflict."""
    payload = {
        "sku": "DUPE-SKU-01",
        "name": "First Product",
        "category_id": sample_category,
        "unit_price": "10.00",
        "cost_price": "5.00",
        "initial_stock": 10,
    }

    # First creation succeeds
    resp1 = client.post(
        "/api/products",
        json=payload,
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert resp1.status_code == 201

    # Second creation with identical SKU fails
    resp2 = client.post(
        "/api/products",
        json=payload,
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert resp2.status_code == 409
    assert resp2.get_json()["error"]["code"] == "DUPLICATE_SKU"


def test_staff_cannot_create_product(client, auth_tokens, sample_category):
    """Test RBAC: Staff user cannot create products (403 Forbidden)."""
    payload = {
        "sku": "STAFF-PROD",
        "name": "Staff Attempt",
        "category_id": sample_category,
        "unit_price": "10.00",
        "cost_price": "5.00",
    }

    response = client.post(
        "/api/products",
        json=payload,
        headers={"Authorization": f"Bearer {auth_tokens['staff']}"},
    )
    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "FORBIDDEN"


def test_filter_low_stock_products(client, auth_tokens, sample_category):
    """Test querying products with low_stock=true filter."""
    headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}

    # Product A: Stock = 5, Threshold = 10 (Low Stock)
    client.post(
        "/api/products",
        json={"sku": "LOW-01", "name": "Low Item", "category_id": sample_category, "initial_stock": 5, "low_stock_threshold": 10},
        headers=headers,
    )

    # Product B: Stock = 50, Threshold = 10 (Healthy Stock)
    client.post(
        "/api/products",
        json={"sku": "HEALTHY-01", "name": "Healthy Item", "category_id": sample_category, "initial_stock": 50, "low_stock_threshold": 10},
        headers=headers,
    )

    # Fetch low-stock only
    resp = client.get("/api/products?low_stock=true", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    skus = [p["sku"] for p in data]
    assert "LOW-01" in skus
    assert "HEALTHY-01" not in skus
