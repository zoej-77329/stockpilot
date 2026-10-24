import pytest
from app.extensions import db
from app.models.user import User
from app.utils.auth import role_required
from flask import jsonify


@pytest.fixture
def seed_users(app):
    """Creates an admin and a staff user in the test database."""
    with app.app_context():
        admin = User(
            username="admin_test",
            email="admin_test@stockpilot.internal",
            role="admin",
            is_active=True,
        )
        admin.set_password("AdminPass123!")

        staff = User(
            username="staff_test",
            email="staff_test@stockpilot.internal",
            role="staff",
            is_active=True,
        )
        staff.set_password("StaffPass123!")

        disabled = User(
            username="disabled_test",
            email="disabled_test@stockpilot.internal",
            role="staff",
            is_active=False,
        )
        disabled.set_password("DisabledPass123!")

        db.session.add_all([admin, staff, disabled])
        db.session.commit()

        yield {"admin": admin, "staff": staff, "disabled": disabled}


def test_login_success_admin(client, seed_users):
    """Test successful authentication for Admin user."""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "AdminPass123!"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert data["data"]["user"]["username"] == "admin_test"
    assert data["data"]["user"]["role"] == "admin"


def test_login_success_staff(client, seed_users):
    """Test successful authentication for Staff user."""
    response = client.post(
        "/api/auth/login",
        json={"username": "staff_test", "password": "StaffPass123!"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["user"]["role"] == "staff"


def test_login_invalid_password(client, seed_users):
    """Test login failure with wrong credentials returns 401."""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_nonexistent_user(client, seed_users):
    """Test login failure with unknown user returns 401."""
    response = client.post(
        "/api/auth/login",
        json={"username": "unknown_user", "password": "AnyPassword123!"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_disabled_account(client, seed_users):
    """Test that disabled/deactivated accounts are blocked with 403."""
    response = client.post(
        "/api/auth/login",
        json={"username": "disabled_test", "password": "DisabledPass123!"},
    )
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "ACCOUNT_DISABLED"


def test_auth_me_success(client, seed_users):
    """Test retrieving user profile with valid JWT token."""
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "AdminPass123!"},
    )
    token = login_resp.get_json()["data"]["token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["username"] == "admin_test"


def test_auth_me_missing_token(client):
    """Test that requests missing token receive 401 Unauthorized."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_auth_me_invalid_token(client):
    """Test that requests with an invalid/forged token receive 401."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_TOKEN"


def test_role_based_access_control(app, client, seed_users):
    """Test backend enforcement of Admin vs Staff permissions via @role_required."""
    # Define a temporary test route protected by admin role
    @app.route("/api/test-admin-only", methods=["GET"])
    @role_required(["admin"])
    def admin_only_endpoint():
        return jsonify({"success": True, "data": "Admin Area"})

    # 1. Login as Staff
    staff_login = client.post(
        "/api/auth/login",
        json={"username": "staff_test", "password": "StaffPass123!"},
    )
    staff_token = staff_login.get_json()["data"]["token"]

    # 2. Staff accesses Admin endpoint -> 403 Forbidden
    resp = client.get(
        "/api/test-admin-only",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 403
    assert resp.get_json()["error"]["code"] == "FORBIDDEN"

    # 3. Login as Admin
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "AdminPass123!"},
    )
    admin_token = admin_login.get_json()["data"]["token"]

    # 4. Admin accesses Admin endpoint -> 200 OK
    resp = client.get(
        "/api/test-admin-only",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["success"] is True
