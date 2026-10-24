from decimal import Decimal, InvalidOperation
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.product import Product
from app.models.category import Category
from app.models.stock_movement import StockMovement
from app.models.audit_log import AuditLog
from app.utils.auth import role_required, get_current_user

products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("", methods=["GET"])
@role_required(["admin", "staff"])
def list_products():
    """
    List products with search, category filtering, low-stock filtering, and pagination.
    """
    search = request.args.get("search", "").strip()
    category_id = request.args.get("category_id", "").strip()
    low_stock_only = request.args.get("low_stock", "").lower() in ["true", "1", "yes"]
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = Product.query.filter_by(is_active=True)

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if search:
        query = query.filter(
            Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%")
        )

    if low_stock_only:
        query = query.filter(Product.current_stock <= Product.low_stock_threshold)

    pagination = query.order_by(Product.name.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [p.to_dict() for p in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@products_bp.route("/<string:product_id>", methods=["GET"])
@role_required(["admin", "staff"])
def get_product(product_id):
    """Retrieve single product details."""
    product = db.session.get(Product, product_id)
    if not product or not product.is_active:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Product not found."}
        }), 404

    return jsonify({"success": True, "data": product.to_dict()}), 200


@products_bp.route("", methods=["POST"])
@role_required(["admin"])
def create_product():
    """
    Create a new product with duplicate SKU protection and optional initial stock logging.
    Admin only.
    """
    data = request.get_json(silent=True) or {}
    sku = data.get("sku", "").strip().upper()
    name = data.get("name", "").strip()
    category_id = data.get("category_id", "").strip()

    if not sku or not name or not category_id:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "SKU, Name, and Category are required."}
        }), 400

    # Verify category exists
    category = db.session.get(Category, category_id)
    if not category:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Selected category does not exist."}
        }), 404

    # Enforce duplicate SKU invariant
    existing = Product.query.filter_by(sku=sku).first()
    if existing:
        return jsonify({
            "success": False,
            "error": {"code": "DUPLICATE_SKU", "message": f"Product with SKU '{sku}' already exists."}
        }), 409

    try:
        unit_price = Decimal(str(data.get("unit_price", "0.00")))
        cost_price = Decimal(str(data.get("cost_price", "0.00")))
        initial_stock = int(data.get("initial_stock", 0))
        threshold = int(data.get("low_stock_threshold", 10))

        if unit_price < 0 or cost_price < 0 or initial_stock < 0 or threshold < 0:
            raise ValueError()
    except (InvalidOperation, ValueError):
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Prices, stock, and threshold must be non-negative numbers."}
        }), 400

    current_user = get_current_user()

    product = Product(
        sku=sku,
        name=name,
        description=data.get("description", "").strip() or None,
        category_id=category_id,
        unit_price=unit_price,
        cost_price=cost_price,
        current_stock=initial_stock,
        low_stock_threshold=threshold,
    )
    db.session.add(product)
    db.session.flush()

    # Record initial stock in immutable movement ledger
    if initial_stock > 0:
        movement = StockMovement(
            product_id=product.id,
            movement_type="RECEIPT",
            quantity_delta=initial_stock,
            reference_type="INITIAL_STOCK",
            reference_id=product.id,
            unit_cost=cost_price,
            notes="Initial stock entered during product creation",
            created_by=current_user.id,
        )
        db.session.add(movement)

    audit = AuditLog(
        user_id=current_user.id,
        action="PRODUCT_CREATE",
        entity_type="PRODUCT",
        entity_id=product.id,
        details={"sku": sku, "name": name, "initial_stock": initial_stock},
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "data": product.to_dict()}), 201


@products_bp.route("/<string:product_id>", methods=["PUT"])
@role_required(["admin"])
def update_product(product_id):
    """Update product information (Admin only)."""
    product = db.session.get(Product, product_id)
    if not product or not product.is_active:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Product not found."}
        }), 404

    data = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        product.name = data["name"].strip()
    if "description" in data:
        product.description = data["description"].strip() or None
    if "category_id" in data and data["category_id"].strip():
        cat = db.session.get(Category, data["category_id"].strip())
        if not cat:
            return jsonify({
                "success": False,
                "error": {"code": "NOT_FOUND", "message": "Category not found."}
            }), 404
        product.category_id = cat.id

    try:
        if "unit_price" in data:
            up = Decimal(str(data["unit_price"]))
            if up < 0:
                raise ValueError()
            product.unit_price = up
        if "cost_price" in data:
            cp = Decimal(str(data["cost_price"]))
            if cp < 0:
                raise ValueError()
            product.cost_price = cp
        if "low_stock_threshold" in data:
            th = int(data["low_stock_threshold"])
            if th < 0:
                raise ValueError()
            product.low_stock_threshold = th
    except (InvalidOperation, ValueError):
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Invalid numeric values provided."}
        }), 400

    db.session.commit()
    return jsonify({"success": True, "data": product.to_dict()}), 200


@products_bp.route("/<string:product_id>", methods=["DELETE"])
@role_required(["admin"])
def deactivate_product(product_id):
    """Soft deactivation of a product to preserve historical orders."""
    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Product not found."}
        }), 404

    product.is_active = False
    current_user = get_current_user()

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="PRODUCT_DEACTIVATE",
        entity_type="PRODUCT",
        entity_id=product.id,
        details={"sku": product.sku},
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "data": {"message": f"Product '{product.sku}' deactivated."}}), 200
