from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.category import Category
from app.models.audit_log import AuditLog
from app.utils.auth import role_required, get_current_user

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@categories_bp.route("", methods=["GET"])
@role_required(["admin", "staff"])
def list_categories():
    """List all categories with associated product counts."""
    categories = Category.query.order_by(Category.name.asc()).all()
    return jsonify({
        "success": True,
        "data": [c.to_dict() for c in categories]
    }), 200


@categories_bp.route("", methods=["POST"])
@role_required(["admin"])
def create_category():
    """Create a new product category (Admin only)."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip() or None

    if not name:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Category name is required."}
        }), 400

    existing = Category.query.filter(Category.name.ilike(name)).first()
    if existing:
        return jsonify({
            "success": False,
            "error": {"code": "DUPLICATE_CATEGORY", "message": f"Category '{name}' already exists."}
        }), 409

    current_user = get_current_user()
    category = Category(name=name, description=description)
    db.session.add(category)
    db.session.flush()

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="CATEGORY_CREATE",
        entity_type="CATEGORY",
        entity_id=category.id,
        details={"name": name},
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "data": category.to_dict()}), 201


@categories_bp.route("/<string:category_id>", methods=["PUT"])
@role_required(["admin"])
def update_category(category_id):
    """Update existing category details (Admin only)."""
    category = Category.query.get(category_id)
    if not category:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Category not found."}
        }), 404

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if name:
        existing = Category.query.filter(Category.name.ilike(name), Category.id != category_id).first()
        if existing:
            return jsonify({
                "success": False,
                "error": {"code": "DUPLICATE_CATEGORY", "message": f"Category '{name}' already exists."}
            }), 409
        category.name = name

    if "description" in data:
        category.description = data.get("description")

    db.session.commit()
    return jsonify({"success": True, "data": category.to_dict()}), 200
