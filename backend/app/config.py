import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration with defaults."""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-replace-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-replace-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 8))
    )

    # Database Configuration
    raw_db_url = os.getenv(
        "DATABASE_URL",
        "postgresql://stockpilot_user:stockpilot_pass@localhost:5432/stockpilot",
    )
    # SQLAlchemy 2.x uses psycopg3 for 'postgresql://'. Ensure 'postgresql+psycopg2://' when using psycopg2-binary
    if raw_db_url:
        if raw_db_url.startswith("postgres://"):
            raw_db_url = raw_db_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+"):
            raw_db_url = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    SQLALCHEMY_DATABASE_URI = raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # CORS
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    TESTING = False


class DevelopmentConfig(Config):
    """Local development environment configuration."""

    DEBUG = True


class TestingConfig(Config):
    """Testing environment configuration."""

    TESTING = True
    DEBUG = False
    # Use file-based SQLite for testing to support true multi-connection concurrency
    test_db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_stockpilot.db"
    )
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL", f"sqlite:///{test_db_path}"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"timeout": 15},
    }
    JWT_SECRET_KEY = "test-jwt-secret-key-that-is-at-least-32-bytes-long"
    SECRET_KEY = "test-secret-key-that-is-at-least-32-bytes-long"


class ProductionConfig(Config):
    """Production cloud environment configuration."""

    DEBUG = False
    TESTING = False

    def __init__(self):
        super().__init__()
        # Enforce that real secrets are supplied in production
        if os.getenv("SECRET_KEY", "").startswith("dev-"):
            raise ValueError("Production SECRET_KEY must be a secure, non-default secret.")
        if os.getenv("JWT_SECRET_KEY", "").startswith("dev-"):
            raise ValueError("Production JWT_SECRET_KEY must be a secure, non-default secret.")


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(config_name=None):
    if not config_name:
        config_name = os.getenv("FLASK_ENV", "development").lower()
    return config_by_name.get(config_name, DevelopmentConfig)
