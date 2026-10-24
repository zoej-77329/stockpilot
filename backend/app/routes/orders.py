from flask import Blueprint, request, jsonify
from sqlalchemy.orm.exc import StaleDataError
from app.models.order import Order
from app.services.order_service import (
    create_order,
    cancel_order,
    InsufficientStockException,
)
from app.utils.auth import role_required, get_current_user
from app.extensions import db

import logging

logger = logging.getLogger(__name__)

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


@orders_bp.route("", methods=["GET"])
@role_required(["admin", "staff"])
def list_orders():
    """List customer orders with status filter and pagination."""
    status = request.args.get("status", "").strip().upper()
    search = request.args.get("search", "").strip()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = Order.query

    if status:
        query = query.filter(Order.status == status)

    if search:
        query = query.filter(Order.order_number.ilike(f"%{search}%"))

    pagination = query.order_by(Order.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [o.to_dict() for o in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@orders_bp.route("/<string:order_id>", methods=["GET"])
@role_required(["admin", "staff"])
def get_order_details(order_id):
    """Retrieve details and line items for a specific order."""
    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Order not found."}
        }), 404

    return jsonify({"success": True, "data": order.to_dict()}), 200


@orders_bp.route("", methods=["POST"])
@role_required(["admin", "staff"])
def place_order():
    """
    Place a multi-line customer order.
    Atomically validates and deducts inventory using row-level locking.
    Returns HTTP 409 Conflict if stock is insufficient, preventing overselling.
    """
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customer_id")
    items = data.get("items", [])
    tax_rate = data.get("tax_rate", 0.0)

    if not customer_id or not items:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Customer ID and order items are required."}
        }), 400

    current_user = get_current_user()

    try:
        _, order_data = create_order(
            customer_id=customer_id,
            items=items,
            tax_rate_val=tax_rate,
            user_id=current_user.id,
        )
        return jsonify({"success": True, "data": order_data}), 201
    except (InsufficientStockException, StaleDataError) as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {
                "code": "INSUFFICIENT_STOCK",
                "message": str(e) if isinstance(e, InsufficientStockException) else "Inventory was updated concurrently by another request. Stock exhausted.",
                "sku": getattr(e, "sku", None),
                "available": getattr(e, "available", 0),
                "requested": getattr(e, "requested", 0),
            }
        }), 409
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": str(e)}
        }), 400
    except Exception as e:
        logger.error("Failed to process order: %s", str(e), exc_info=True)
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "SERVER_ERROR", "message": f"Failed to process order: {str(e)}"}
        }), 500


@orders_bp.route("/<string:order_id>/status", methods=["PUT"])
@role_required(["admin"])
def update_order_status(order_id):
    """
    Transition order status (Admin only).
    Transitioning to CANCELLED atomically restores deducted inventory.
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").strip().upper()
    reason = data.get("reason", "").strip() or None

    if new_status != "CANCELLED":
        return jsonify({
            "success": False,
            "error": {"code": "INVALID_TRANSITION", "message": "Supported status update is 'CANCELLED'."}
        }), 400

    current_user = get_current_user()

    try:
        _, order_data = cancel_order(
            order_id=order_id,
            reason=reason,
            user_id=current_user.id,
        )
        return jsonify({"success": True, "data": order_data}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "INVALID_OPERATION", "message": str(e)}
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "SERVER_ERROR", "message": "Failed to update order status."}
        }), 500
