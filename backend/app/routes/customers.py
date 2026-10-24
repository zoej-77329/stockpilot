from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.customer import Customer
from app.models.audit_log import AuditLog
from app.utils.auth import role_required, get_current_user

customers_bp = Blueprint("customers", __name__, url_prefix="/api/customers")


@customers_bp.route("", methods=["GET"])
@role_required(["admin", "staff"])
def list_customers():
    """List customers with search and pagination."""
    search = request.args.get("search", "").strip()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = Customer.query.filter_by(is_active=True)
    if search:
        query = query.filter(
            Customer.name.ilike(f"%{search}%") |
            Customer.email.ilike(f"%{search}%") |
            Customer.phone.ilike(f"%{search}%")
        )

    pagination = query.order_by(Customer.name.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [c.to_dict() for c in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200


@customers_bp.route("", methods=["POST"])
@role_required(["admin", "staff"])
def create_customer():
    """Register a new customer."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()

    if not name or not email:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Name and valid email are required."}
        }), 400

    existing = Customer.query.filter_by(email=email).first()
    if existing:
        return jsonify({
            "success": False,
            "error": {"code": "DUPLICATE_CUSTOMER", "message": f"Customer with email '{email}' already exists."}
        }), 409

    current_user = get_current_user()
    customer = Customer(
        name=name,
        email=email,
        phone=data.get("phone", "").strip() or None,
        address=data.get("address", "").strip() or None,
    )
    db.session.add(customer)
    db.session.flush()

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="CUSTOMER_CREATE",
        entity_type="CUSTOMER",
        entity_id=customer.id,
        details={"name": name, "email": email},
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({"success": True, "data": customer.to_dict()}), 201


@customers_bp.route("/<string:customer_id>", methods=["PUT"])
@role_required(["admin", "staff"])
def update_customer(customer_id):
    """Update customer contact info."""
    customer = db.session.get(Customer, customer_id)
    if not customer:
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Customer not found."}
        }), 404

    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        customer.name = data["name"].strip()
    if "email" in data and data["email"].strip():
        email = data["email"].strip().lower()
        existing = Customer.query.filter(Customer.email == email, Customer.id != customer_id).first()
        if existing:
            return jsonify({
                "success": False,
                "error": {"code": "DUPLICATE_CUSTOMER", "message": f"Email '{email}' is already in use."}
            }), 409
        customer.email = email
    if "phone" in data:
        customer.phone = data["phone"].strip() or None
    if "address" in data:
        customer.address = data["address"].strip() or None

    db.session.commit()
    return jsonify({"success": True, "data": customer.to_dict()}), 200
