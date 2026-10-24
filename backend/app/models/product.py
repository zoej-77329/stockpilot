import uuid
from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class Product(db.Model):
    """Product catalog and inventory model."""

    __tablename__ = "products"
    __table_args__ = (
        db.CheckConstraint("current_stock >= 0", name="chk_product_stock_non_negative"),
        db.CheckConstraint("unit_price >= 0", name="chk_product_unit_price_non_negative"),
        db.CheckConstraint("cost_price >= 0", name="chk_product_cost_price_non_negative"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sku = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    category_id = db.Column(
        db.String(36), db.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    unit_price = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    cost_price = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    current_stock = db.Column(db.Integer, nullable=False, default=0)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=10)
    version = db.Column(db.Integer, nullable=False, default=1)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    __mapper_args__ = {
        "version_id_col": version
    }
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    category = db.relationship("Category", back_populates="products")
    stock_movements = db.relationship("StockMovement", back_populates="product", lazy="dynamic")

    @property
    def is_low_stock(self) -> bool:
        """Flags product when stock is at or below threshold."""
        return self.current_stock <= self.low_stock_threshold

    def to_dict(self):
        return {
            "id": self.id,
            "sku": self.sku,
            "name": self.name,
            "description": self.description,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "unit_price": str(self.unit_price),
            "cost_price": str(self.cost_price),
            "current_stock": self.current_stock,
            "low_stock_threshold": self.low_stock_threshold,
            "is_low_stock": self.is_low_stock,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
