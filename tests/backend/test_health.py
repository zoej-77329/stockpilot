from unittest.mock import patch
from sqlalchemy.exc import OperationalError


def test_health_check_healthy(client):
    """
    Test that the /api/health endpoint returns 200 OK with connected status
    when the database is reachable.
    """
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.is_json

    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "timestamp" in data
    assert data["version"] == "1.0.0"
    assert "error" not in data


def test_health_check_database_failure(client):
    """
    Test that the /api/health endpoint returns 503 Service Unavailable
    and explicitly marks database as disconnected when the DB query fails.
    Fulfills requirement: 'Do not report the database as healthy when its connection fails.'
    """
    with patch("app.routes.health.db.session.execute") as mock_execute:
        mock_execute.side_effect = OperationalError(
            "could not connect to server", params=None, orig=None
        )

        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.is_json

        data = response.get_json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "timestamp" in data
        assert "error" in data
        assert "Database connection unavailable" in data["error"]


def test_health_check_unexpected_exception(client):
    """
    Test that even unexpected internal database exceptions result in a 503
    rather than a masked 200 or an unhandled 500 crash.
    """
    with patch("app.routes.health.db.session.execute") as mock_execute:
        mock_execute.side_effect = RuntimeError("Fatal connection pool failure")

        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.is_json

        data = response.get_json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
