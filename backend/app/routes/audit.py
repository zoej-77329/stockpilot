from flask import Blueprint, request, jsonify
from app.models.audit_log import AuditLog
from app.utils.auth import role_required

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit-logs")


@audit_bp.route("", methods=["GET"])
@role_required(["admin"])
def list_audit_logs():
    """List system security and audit events (Admin only)."""
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    action = request.args.get("action", "").strip()

    query = AuditLog.query
    if action:
        query = query.filter(AuditLog.action == action)

    pagination = query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "success": True,
        "data": [log.to_dict() for log in pagination.items],
        "meta": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        }
    }), 200
