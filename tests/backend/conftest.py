import sys
from pathlib import Path
import pytest

# Ensure the backend directory is in the Python module search path
backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app
from app.extensions import db


@pytest.fixture
def app():
    """Create and configure a clean Flask application instance for testing."""
    test_app = create_app("testing")

    with test_app.app_context():
        db.create_all()
        yield test_app
        db.session.remove()
        db.drop_all()

    # Clean up test database file if created
    test_db_file = backend_dir / "test_stockpilot.db"
    if test_db_file.exists():
        try:
            test_db_file.unlink()
        except Exception:
            pass


@pytest.fixture
def client(app):
    """A test client for the application."""
    return app.test_client()
