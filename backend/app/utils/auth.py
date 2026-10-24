from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from app.extensions import db
from app.models.user import User


def role_required(allowed_roles):
    """
    Decorator enforcing that the authenticated user possesses one of the allowed roles.
    Returns 401 if token is missing/invalid, 403 if user lacks required role or is inactive.
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_id = get_jwt_identity()

            user = db.session.get(User, user_id)
            if not user or not user.is_active:
                return jsonify({
                    "success": False,
                    "error": {
                        "code": "ACCOUNT_DISABLED",
                        "message": "User account is inactive or no longer exists."
                    }
                }), 403

            user_role = claims.get("role", user.role)
            if user_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "error": {
                        "code": "FORBIDDEN",
                        "message": f"Operation requires one of the following roles: {', '.join(allowed_roles)}."
                    }
                }), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user():
    """Helper to fetch the current active authenticated User model instance."""
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return db.session.get(User, user_id)
