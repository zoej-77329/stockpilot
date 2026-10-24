import uuid
from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class Order(db.Model):
    """Customer sales order model."""

    __tablename__ = "orders"
    __table_args__ = (
        db.CheckConstraint("subtotal >= 0", name="chk_order_subtotal_non_negative"),
        db.CheckConstraint("total_amount >= 0", name="chk_order_total_non_negative"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    customer_id = db.Column(
        db.String(36), db.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status = db.Column(
        db.String(20), nullable=False, default="CONFIRMED", index=True
    )  # 'PENDING', 'CONFIRMED', 'CANCELLED'
    subtotal = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    tax_rate = db.Column(db.Numeric(5, 4), nullable=False, default=Decimal("0.0000"))
    tax_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    customer = db.relationship("Customer", back_populates="orders")
    creator = db.relationship("User")
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "order_number": self.order_number,
            "customer_id": self.customer_id,
            "customer_name": self.customer.name if self.customer else None,
            "status": self.status,
            "subtotal": str(self.subtotal),
            "tax_rate": str(self.tax_rate),
            "tax_amount": str(self.tax_amount),
            "total_amount": str(self.total_amount),
            "item_count": sum(item.quantity for item in self.items),
            "created_by": self.created_by,
            "created_by_username": self.creator.username if self.creator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "items": [item.to_dict() for item in self.items],
        }


class OrderItem(db.Model):
    """Line item in a customer order with snapshot pricing."""

    __tablename__ = "order_items"
    __table_args__ = (
        db.CheckConstraint("quantity > 0", name="chk_order_item_quantity_positive"),
        db.CheckConstraint("unit_price >= 0", name="chk_order_item_price_non_negative"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = db.Column(
        db.String(36), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = db.Column(
        db.String(36), db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)  # Historical snapshot price
    total_price = db.Column(db.Numeric(12, 2), nullable=False)

    # Relationships
    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "quantity": self.quantity,
            "unit_price": str(self.unit_price),
            "total_price": str(self.total_price),
        }
