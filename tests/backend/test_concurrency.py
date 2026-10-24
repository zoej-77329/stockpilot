import threading
from decimal import Decimal
import pytest
from app.extensions import db
from app.models.user import User
from app.models.category import Category
from app.models.customer import Customer
from app.models.product import Product
from app.models.order import Order


@pytest.fixture
def concurrency_fixture(client, app):
    """Sets up a limited inventory product for concurrency testing."""
    with app.app_context():
        admin = User(username="admin_c", email="admin_c@test.com", role="admin")
        admin.set_password("Pass123!")
        db.session.add(admin)
        db.session.flush()

        cat = Category(name="Limited Stock")
        db.session.add(cat)
        db.session.flush()

        cust = Customer(name="Flash Buyer", email="buyer@flash.com")
        db.session.add(cust)
        db.session.flush()

        # Only 1 unit available in stock!
        limited_product = Product(
            sku="CONCUR-LAST-01",
            name="Limited Edition Watch",
            category_id=cat.id,
            unit_price=Decimal("199.99"),
            cost_price=Decimal("100.00"),
            current_stock=1,
            low_stock_threshold=5,
        )
        db.session.add(limited_product)
        db.session.commit()

        prod_id = limited_product.id
        cust_id = cust.id

    token = client.post(
        "/api/auth/login", json={"username": "admin_c", "password": "Pass123!"}
    ).get_json()["data"]["token"]

    return {
        "token": token,
        "product_id": prod_id,
        "customer_id": cust_id,
    }


def test_concurrent_checkout_anti_oversell(app, concurrency_fixture):
    """
    Test that concurrent checkout requests competing for the exact same
    final remaining unit cannot oversell inventory.
    Exactly ONE request must succeed (201); the other must be rejected (409).
    Final inventory must be 0, never negative.
    """
    results = []
    lock = threading.Lock()

    def place_order_attempt():
        # Each thread gets its own test client within the application context
        with app.test_client() as thread_client:
            resp = thread_client.post(
                "/api/orders",
                json={
                    "customer_id": concurrency_fixture["customer_id"],
                    "items": [{"product_id": concurrency_fixture["product_id"], "quantity": 1}],
                },
                headers={"Authorization": f"Bearer {concurrency_fixture['token']}"},
            )
            with lock:
                results.append(resp.status_code)

    # Launch two simultaneous checkout threads
    t1 = threading.Thread(target=place_order_attempt)
    t2 = threading.Thread(target=place_order_attempt)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    # Close any stale session in main thread so SQLite reads fresh committed state
    db.session.remove()

    # Verify outcomes: exactly one 201 Created and one 409 Conflict
    assert 201 in results, f"Expected at least one order to succeed. Results: {results}"
    assert 409 in results, f"Expected second order to be rejected with 409. Results: {results}"
    assert len(results) == 2

    # Verify via API that final stock is exactly 0
    with app.test_client() as verify_client:
        verify_resp = verify_client.get(
            f"/api/products/{concurrency_fixture['product_id']}",
            headers={"Authorization": f"Bearer {concurrency_fixture['token']}"},
        )
        assert verify_resp.status_code == 200
        current_stock = verify_resp.get_json()["data"]["current_stock"]
        assert current_stock == 0, f"Stock was not decremented to 0! Current stock: {current_stock}"


def test_sequential_exhaustion_then_rejection(client, concurrency_fixture):
    """
    Test rapid sequential checkout down to zero inventory, followed by
    immediate rejection of any further purchase attempts.
    """
    headers = {"Authorization": f"Bearer {concurrency_fixture['token']}"}

    # Order 1: Buy the 1 available unit -> 201 Created
    resp1 = client.post(
        "/api/orders",
        json={
            "customer_id": concurrency_fixture["customer_id"],
            "items": [{"product_id": concurrency_fixture["product_id"], "quantity": 1}],
        },
        headers=headers,
    )
    assert resp1.status_code == 201

    # Order 2: Attempt buying another unit when stock is 0 -> 409 Conflict
    resp2 = client.post(
        "/api/orders",
        json={
            "customer_id": concurrency_fixture["customer_id"],
            "items": [{"product_id": concurrency_fixture["product_id"], "quantity": 1}],
        },
        headers=headers,
    )
    assert resp2.status_code == 409
    assert resp2.get_json()["error"]["code"] == "INSUFFICIENT_STOCK"
