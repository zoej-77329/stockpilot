from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.supplier import Supplier
from app.models.audit_log import AuditLog
from app.utils.auth import role_required, get_current_user

suppliers_bp = Blueprint("suppliers", __name__, url_prefix="/api/suppliers")


@suppliers_bp.route("", methods=["GET"])
@role_required(["admin", "staff"])
def list_suppliers():
    """List suppliers with search and pagination."""
    search = request.args.get("search", "").strip()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = Supplier.query.filter_by(is_active=True)
    if search:
        query = query.filter(
            Supplier.name.ilike(f"%{search}%") |
            Supplier.contact_name.ilike(f"%{search}%") |
            Supplier.email.ilike(f"%{search}%")
        )

    pagination = query.order_by(Supplier.name.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [s.to_dict() for s in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@suppliers_bp.route("", methods=["POST"])
@role_required(["admin"])
def create_supplier():
    """Create a new supplier (Admin only)."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Supplier name is required."}
        }), 400

    current_user = get_current_user()
    supplier = Supplier(
        name=name,
        contact_name=data.get("contact_name", "").strip() or None,
        email=data.get("email", "").strip() or None,
        phone=data.get("phone", "").strip() or None,
        address=data.get("address", "").strip() or None,
    )
    db.session.add(supplier)
    db.session.flush()

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="SUPPLIER_CREATE",
        entity_type="SUPPLIER",
        entity_id=supplier.id,
        details={"name": name},
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "data": supplier.to_dict()}), 201


@suppliers_bp.route("/<string:supplier_id>", methods=["PUT"])
@role_required(["admin"])
def update_supplier(supplier_id):
    """Update supplier details (Admin only)."""
    supplier = db.session.get(Supplier, supplier_id)
    if not supplier:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Supplier not found."}
        }), 404

    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        supplier.name = data["name"].strip()
    if "contact_name" in data:
        supplier.contact_name = data["contact_name"].strip() or None
    if "email" in data:
        supplier.email = data["email"].strip() or None
    if "phone" in data:
        supplier.phone = data["phone"].strip() or None
    if "address" in data:
        supplier.address = data["address"].strip() or None

    db.session.commit()
    return jsonify({"success": True, "data": supplier.to_dict()}), 200
