import uuid
from datetime import datetime, timezone
from app.extensions import db


class Category(db.Model):
    """Product category model."""

    __tablename__ = "categories"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "product_count": self.products.filter_by(is_active=True).count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
