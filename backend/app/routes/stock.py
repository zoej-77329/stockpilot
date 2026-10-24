from flask import Blueprint, request, jsonify
from app.models.stock_receipt import StockReceipt
from app.models.stock_adjustment import StockAdjustment
from app.models.stock_movement import StockMovement
from app.services.stock_service import (
    create_stock_receipt,
    create_stock_adjustment,
    InsufficientStockException,
)
from app.utils.auth import role_required, get_current_user
from app.extensions import db

stock_bp = Blueprint("stock", __name__, url_prefix="/api/stock")


@stock_bp.route("/receipts", methods=["GET"])
@role_required(["admin", "staff"])
def list_receipts():
    """List inbound stock receipts with pagination."""
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    pagination = StockReceipt.query.order_by(StockReceipt.received_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [r.to_dict() for r in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@stock_bp.route("/receipts", methods=["POST"])
@role_required(["admin", "staff"])
def record_receipt():
    """Record an inbound shipment of goods from a supplier."""
    data = request.get_json(silent=True) or {}
    supplier_id = data.get("supplier_id")
    items = data.get("items", [])
    notes = data.get("notes", "").strip() or None

    if not supplier_id or not items:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Supplier ID and at least one item are required."}
        }), 400

    current_user = get_current_user()

    try:
        receipt = create_stock_receipt(
            supplier_id=supplier_id,
            items=items,
            notes=notes,
            user_id=current_user.id,
        )
        return jsonify({"success": True, "data": receipt.to_dict()}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": str(e)}
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "SERVER_ERROR", "message": "Failed to record stock receipt."}
        }), 500


@stock_bp.route("/adjustments", methods=["GET"])
@role_required(["admin", "staff"])
def list_adjustments():
    """List manual inventory adjustments."""
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    pagination = StockAdjustment.query.order_by(StockAdjustment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [a.to_dict() for a in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@stock_bp.route("/adjustments", methods=["POST"])
@role_required(["admin"])
def record_adjustment():
    """Record manual stock adjustment (Admin only)."""
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    reason = data.get("reason", "").strip().upper()
    notes = data.get("notes", "").strip() or None

    try:
        delta = int(data.get("quantity_delta", 0))
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Quantity delta must be an integer."}
        }), 400

    if not product_id or not reason:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Product ID and valid reason are required."}
        }), 400

    current_user = get_current_user()

    try:
        adjustment = create_stock_adjustment(
            product_id=product_id,
            reason=reason,
            quantity_delta=delta,
            notes=notes,
            user_id=current_user.id,
        )
        return jsonify({"success": True, "data": adjustment.to_dict()}), 201
    except InsufficientStockException as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "INSUFFICIENT_STOCK", "message": str(e)}
        }), 422
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": str(e)}
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": {"code": "SERVER_ERROR", "message": "Failed to process stock adjustment."}
        }), 500


@stock_bp.route("/movements", methods=["GET"])
@role_required(["admin", "staff"])
def list_movements():
    """Query immutable stock movement ledger with filtering and pagination."""
    product_id = request.args.get("product_id", "").strip()
    movement_type = request.args.get("movement_type", "").strip().upper()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = StockMovement.query

    if product_id:
        query = query.filter(StockMovement.product_id == product_id)

    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)

    pagination = query.order_by(StockMovement.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [m.to_dict() for m in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200
