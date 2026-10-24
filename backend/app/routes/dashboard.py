from decimal import Decimal
from flask import Blueprint, jsonify
from sqlalchemy import func
from app.models.product import Product
from app.models.order import Order
from app.models.stock_movement import StockMovement
from app.utils.auth import role_required
from app.extensions import db

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("/stats", methods=["GET"])
@role_required(["admin", "staff"])
def get_dashboard_stats():
    """
    Returns executive inventory and order metrics, low-stock alerts,
    and recent movement activity.
    """
    # 1. Product & Inventory valuation calculations
    active_products = Product.query.filter_by(is_active=True).all()
    total_active_products = len(active_products)

    total_inventory_value = sum(
        (p.current_stock * p.cost_price for p in active_products), Decimal("0.00")
    )

    low_stock_products = [p for p in active_products if p.is_low_stock]
    low_stock_count = len(low_stock_products)
    out_of_stock_count = sum(1 for p in active_products if p.current_stock == 0)

    # 2. Orders and revenue metrics
    orders_query = Order.query.filter(Order.status != "CANCELLED")
    total_orders = orders_query.count()
    revenue_sum = db.session.query(
        func.coalesce(func.sum(Order.total_amount), Decimal("0.00"))
    ).filter(Order.status != "CANCELLED").scalar()

    # 3. Recent inventory movements
    recent_movements = (
        StockMovement.query.order_by(StockMovement.created_at.desc()).limit(10).all()
    )

    return jsonify({
        "success": True,
        "data": {
            "total_inventory_value": str(total_inventory_value.quantize(Decimal("0.01"))),
            "total_active_products": total_active_products,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "total_orders": total_orders,
            "total_revenue": str(Decimal(str(revenue_sum)).quantize(Decimal("0.01"))),
            "low_stock_items": [p.to_dict() for p in low_stock_products[:5]],
            "recent_movements": [m.to_dict() for m in recent_movements],
        }
    }), 200
