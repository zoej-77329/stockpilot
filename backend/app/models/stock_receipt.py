import uuid
from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class StockReceipt(db.Model):
    """Inbound shipment record received from a supplier."""

    __tablename__ = "stock_receipts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    receipt_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    supplier_id = db.Column(
        db.String(36), db.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    total_cost = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    notes = db.Column(db.Text, nullable=True)
    received_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    received_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    supplier = db.relationship("Supplier", back_populates="stock_receipts")
    receiver = db.relationship("User")
    items = db.relationship(
        "StockReceiptItem", back_populates="stock_receipt", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "receipt_number": self.receipt_number,
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.name if self.supplier else None,
            "total_cost": str(self.total_cost),
            "notes": self.notes,
            "received_by": self.received_by,
            "received_by_username": self.receiver.username if self.receiver else None,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "items": [item.to_dict() for item in self.items],
        }


class StockReceiptItem(db.Model):
    """Line items within a stock receipt."""

    __tablename__ = "stock_receipt_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    stock_receipt_id = db.Column(
        db.String(36), db.ForeignKey("stock_receipts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = db.Column(
        db.String(36), db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity = db.Column(db.Integer, nullable=False)
    unit_cost = db.Column(db.Numeric(12, 2), nullable=False)
    total_cost = db.Column(db.Numeric(12, 2), nullable=False)

    # Relationships
    stock_receipt = db.relationship("StockReceipt", back_populates="items")
    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "stock_receipt_id": self.stock_receipt_id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "quantity": self.quantity,
            "unit_cost": str(self.unit_cost),
            "total_cost": str(self.total_cost),
        }
