from app.routes.health import health_bp
from app.routes.auth import auth_bp
from app.routes.categories import categories_bp
from app.routes.suppliers import suppliers_bp
from app.routes.customers import customers_bp
from app.routes.products import products_bp
from app.routes.stock import stock_bp
from app.routes.orders import orders_bp
from app.routes.dashboard import dashboard_bp
from app.routes.audit import audit_bp

__all__ = [
    "health_bp",
    "auth_bp",
    "categories_bp",
    "suppliers_bp",
    "customers_bp",
    "products_bp",
    "stock_bp",
    "orders_bp",
    "dashboard_bp",
    "audit_bp",
]
