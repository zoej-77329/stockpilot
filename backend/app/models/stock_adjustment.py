import uuid
from datetime import datetime, timezone
from app.extensions import db


class StockAdjustment(db.Model):
    """Manual inventory correction record for damage, loss, or count reconciliation."""

    __tablename__ = "stock_adjustments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    adjustment_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    product_id = db.Column(
        db.String(36), db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reason = db.Column(db.String(50), nullable=False)  # DAMAGED, LOST, EXPIRED, COUNT_RECONCILIATION
    quantity_delta = db.Column(db.Integer, nullable=False)
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    adjusted_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    product = db.relationship("Product")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "adjustment_number": self.adjustment_number,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "reason": self.reason,
            "quantity_delta": self.quantity_delta,
            "previous_stock": self.previous_stock,
            "new_stock": self.new_stock,
            "notes": self.notes,
            "adjusted_by": self.adjusted_by,
            "adjusted_by_username": self.user.username if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
