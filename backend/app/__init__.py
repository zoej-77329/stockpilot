import logging
import sys
from flask import Flask, jsonify
from app.config import get_config
from app.extensions import db, migrate, jwt, cors
from app.routes import (
    health_bp,
    auth_bp,
    categories_bp,
    suppliers_bp,
    customers_bp,
    products_bp,
    stock_bp,
    orders_bp,
    dashboard_bp,
    audit_bp,
)
from app.commands import seed_data


def setup_logging(log_level: str = "INFO"):
    """Configures structured standard output logging."""
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )


def configure_jwt(jwt_manager):
    """Configures standardized JSON error responses for JWT authentication errors."""

    @jwt_manager.unauthorized_loader
    def unauthorized_response(callback):
        return jsonify({
            "success": False,
            "error": {
                "code": "UNAUTHORIZED",
                "message": "Authorization token is missing or request is unauthenticated."
            }
        }), 401

    @jwt_manager.invalid_token_loader
    def invalid_token_response(callback):
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_TOKEN",
                "message": "Signature verification failed or token is malformed."
            }
        }), 401

    @jwt_manager.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({
            "success": False,
            "error": {
                "code": "EXPIRED_TOKEN",
                "message": "Authorization token has expired. Please log in again."
            }
        }), 401


def create_app(config_name: str = None) -> Flask:
    """Application factory for StockPilot Flask API."""
    app = Flask(__name__)

    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)

    # Initialize structured logging
    setup_logging(app.config.get("LOG_LEVEL", "INFO"))
    logger = logging.getLogger(__name__)
    logger.info("Initializing StockPilot backend in '%s' mode", config_name or "default")

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    configure_jwt(jwt)

    # Configure CORS
    allowed_origins = [
        origin.strip()
        for origin in app.config.get("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ]
    cors.init_app(app, resources={r"/api/*": {"origins": allowed_origins}})

    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(suppliers_bp)
    app.register_blueprint(customers_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(stock_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(audit_bp)

    # Register CLI commands
    app.cli.add_command(seed_data)

    return app
