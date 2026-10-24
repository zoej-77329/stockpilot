import uuid
from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.stock_receipt import StockReceipt, StockReceiptItem
from app.models.stock_adjustment import StockAdjustment
from app.models.stock_movement import StockMovement
from app.models.audit_log import AuditLog


class InsufficientStockException(Exception):
    pass


def create_stock_receipt(supplier_id: str, items: list, notes: str, user_id: str) -> StockReceipt:
    """
    Atomically creates an inbound stock receipt, increments product stock,
    and records immutable entries in the stock movement ledger.
    """
    supplier = db.session.get(Supplier, supplier_id)
    if not supplier or not supplier.is_active:
        raise ValueError("Invalid or inactive supplier.")

    if not items:
        raise ValueError("Receipt must contain at least one item.")

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y%m%d")
    short_code = uuid.uuid4().hex[:6].upper()
    count = StockReceipt.query.filter(
        StockReceipt.receipt_number.like(f"REC-{date_str}-%")
    ).count()
    receipt_number = f"REC-{date_str}-{count + 1:04d}-{short_code}"

    receipt = StockReceipt(
        receipt_number=receipt_number,
        supplier_id=supplier_id,
        notes=notes,
        received_by=user_id,
        received_at=now,
    )
    db.session.add(receipt)
    db.session.flush()

    total_cost = Decimal("0.00")

    # Lock and update target products
    for item_data in items:
        product_id = item_data.get("product_id")
        quantity = int(item_data.get("quantity", 0))
        unit_cost = Decimal(str(item_data.get("unit_cost", "0.00")))

        if quantity <= 0:
            raise ValueError(f"Quantity must be greater than zero for all items.")
        if unit_cost < 0:
            raise ValueError(f"Unit cost cannot be negative.")

        product = db.session.query(Product).filter_by(id=product_id).with_for_update().first()
        if not product or not product.is_active:
            raise ValueError(f"Product '{product_id}' not found or inactive.")

        item_total = unit_cost * quantity
        total_cost += item_total

        # Increment current stock
        product.current_stock += quantity
        product.cost_price = unit_cost  # update latest cost

        receipt_item = StockReceiptItem(
            stock_receipt_id=receipt.id,
            product_id=product.id,
            quantity=quantity,
            unit_cost=unit_cost,
            total_cost=item_total,
        )
        db.session.add(receipt_item)

        # Append to immutable movement ledger
        movement = StockMovement(
            product_id=product.id,
            movement_type="RECEIPT",
            quantity_delta=quantity,
            reference_type="RECEIPT",
            reference_id=receipt.id,
            unit_cost=unit_cost,
            notes=f"Received via receipt {receipt_number}",
            created_by=user_id,
            created_at=now,
        )
        db.session.add(movement)

    receipt.total_cost = total_cost

    audit = AuditLog(
        user_id=user_id,
        action="STOCK_RECEIPT_CREATED",
        entity_type="STOCK_RECEIPT",
        entity_id=receipt.id,
        details={"receipt_number": receipt_number, "total_cost": str(total_cost)},
    )
    db.session.add(audit)

    db.session.commit()
    return receipt


def create_stock_adjustment(
    product_id: str, reason: str, quantity_delta: int, notes: str, user_id: str
) -> StockAdjustment:
    """
    Atomically performs manual inventory correction (damage, loss, count reconciliation)
    using row-level locking to ensure stock cannot fall below zero.
    """
    valid_reasons = ["DAMAGED", "LOST", "EXPIRED", "PHYSICAL_COUNT_RECONCILIATION"]
    if reason not in valid_reasons:
        raise ValueError(f"Reason must be one of: {', '.join(valid_reasons)}")

    if quantity_delta == 0:
        raise ValueError("Adjustment quantity delta cannot be zero.")

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y%m%d")
    short_code = uuid.uuid4().hex[:6].upper()
    count = StockAdjustment.query.filter(
        StockAdjustment.adjustment_number.like(f"ADJ-{date_str}-%")
    ).count()
    adj_number = f"ADJ-{date_str}-{count + 1:04d}-{short_code}"

    # Pessimistic row locking on product
    product = db.session.query(Product).filter_by(id=product_id).with_for_update().first()
    if not product or not product.is_active:
        raise ValueError(f"Product '{product_id}' not found or inactive.")

    previous_stock = product.current_stock
    new_stock = previous_stock + quantity_delta

    if new_stock < 0:
        raise InsufficientStockException(
            f"Cannot reduce stock below zero. Current: {previous_stock}, Requested Delta: {quantity_delta}"
        )

    product.current_stock = new_stock

    adjustment = StockAdjustment(
        adjustment_number=adj_number,
        product_id=product.id,
        reason=reason,
        quantity_delta=quantity_delta,
        previous_stock=previous_stock,
        new_stock=new_stock,
        notes=notes,
        adjusted_by=user_id,
        created_at=now,
    )
    db.session.add(adjustment)
    db.session.flush()

    movement = StockMovement(
        product_id=product.id,
        movement_type="ADJUSTMENT",
        quantity_delta=quantity_delta,
        reference_type="ADJUSTMENT",
        reference_id=adjustment.id,
        notes=f"Reason: {reason}. {notes or ''}".strip(),
        created_by=user_id,
        created_at=now,
    )
    db.session.add(movement)

    audit = AuditLog(
        user_id=user_id,
        action="STOCK_ADJUSTMENT_CREATED",
        entity_type="STOCK_ADJUSTMENT",
        entity_id=adjustment.id,
        details={
            "adjustment_number": adj_number,
            "sku": product.sku,
            "previous_stock": previous_stock,
            "new_stock": new_stock,
            "delta": quantity_delta,
        },
    )
    db.session.add(audit)

    db.session.commit()
    return adjustment
