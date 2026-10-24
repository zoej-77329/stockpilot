import uuid
from datetime import datetime, timezone
from app.extensions import db


class StockMovement(db.Model):
    """Immutable audit ledger for every stock change in the system."""

    __tablename__ = "stock_movements"
    __table_args__ = (
        db.Index("idx_stock_movement_created", "created_at"),
        db.CheckConstraint("quantity_delta != 0", name="chk_movement_quantity_non_zero"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = db.Column(
        db.String(36), db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    movement_type = db.Column(
        db.String(30), nullable=False, index=True
    )  # 'RECEIPT', 'ADJUSTMENT', 'ORDER_DEDUCT', 'ORDER_RESTOCK'
    quantity_delta = db.Column(db.Integer, nullable=False)
    reference_type = db.Column(db.String(30), nullable=False)  # 'RECEIPT', 'ORDER', 'ADJUSTMENT'
    reference_id = db.Column(db.String(36), nullable=False, index=True)
    unit_cost = db.Column(db.Numeric(12, 2), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    product = db.relationship("Product", back_populates="stock_movements")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "movement_type": self.movement_type,
            "quantity_delta": self.quantity_delta,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "unit_cost": str(self.unit_cost) if self.unit_cost is not None else None,
            "notes": self.notes,
            "created_by": self.created_by,
            "created_by_username": self.user.username if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
