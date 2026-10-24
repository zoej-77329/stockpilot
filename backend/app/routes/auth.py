import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate user with username and password.
    Returns signed JWT access token and user profile.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "success": False,
            "error": {"code": "BAD_REQUEST", "message": "Missing JSON request body."}
        }), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": "Username and password are required."}
        }), 400

    # Query user by username or email
    user = User.query.filter(
        (User.username == username) | (User.email == username)
    ).first()

    if not user or not user.check_password(password):
        # Audit failed login attempt
        try:
            audit = AuditLog(
                user_id=user.id if user else None,
                action="LOGIN_FAILED",
                entity_type="AUTH",
                details={"attempted_username": username},
                ip_address=request.remote_addr,
            )
            db.session.add(audit)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({
            "success": False,
            "error": {"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."}
        }), 401

    if not user.is_active:
        return jsonify({
            "success": False,
            "error": {"code": "ACCOUNT_DISABLED", "message": "User account is disabled. Contact an administrator."}
        }), 403

    # Generate JWT with custom claims
    additional_claims = {
        "role": user.role,
        "username": user.username,
        "email": user.email,
    }
    access_token = create_access_token(identity=user.id, additional_claims=additional_claims)

    # Audit successful login
    try:
        audit = AuditLog(
            user_id=user.id,
            action="LOGIN_SUCCESS",
            entity_type="AUTH",
            ip_address=request.remote_addr,
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({
        "success": True,
        "data": {
            "token": access_token,
            "user": user.to_dict(),
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user_profile():
    """Returns the authenticated user's profile."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user or not user.is_active:
        return jsonify({
            "success": False,
            "error": {"code": "USER_NOT_FOUND", "message": "User no longer exists or is inactive."}
        }), 404

    return jsonify({
        "success": True,
        "data": user.to_dict()
    }), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logs audit event for logout."""
    user_id = get_jwt_identity()
    try:
        audit = AuditLog(
            user_id=user_id,
            action="LOGOUT",
            entity_type="AUTH",
            ip_address=request.remote_addr,
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({
        "success": True,
        "data": {"message": "Logged out successfully."}
    }), 200
