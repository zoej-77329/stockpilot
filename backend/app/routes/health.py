import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify
from sqlalchemy import text
from app.extensions import db

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.route("/health", methods=["GET"])
def check_health():
    """
    Health check endpoint for Docker probes and AWS ALB Target Group health checks.
    Reports application state and database connectivity status separately.
    Returns:
        HTTP 200: Application and database are healthy.
        HTTP 503: Database connectivity failure (never reports healthy on failure).
    """
    db_connected = False
    error_detail = None

    try:
        # Explicit ping against database engine
        db.session.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        logger.error("Health check database probe failed: %s", str(e), exc_info=False)
        error_detail = "Database connection unavailable"

    status_code = 200 if db_connected else 503
    payload = {
        "status": "healthy" if db_connected else "unhealthy",
        "database": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }

    if error_detail:
        payload["error"] = error_detail

    return jsonify(payload), status_code
