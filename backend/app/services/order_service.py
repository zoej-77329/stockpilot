import uuid
from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db
from app.models.product import Product
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.stock_movement import StockMovement
from app.models.audit_log import AuditLog


class InsufficientStockException(Exception):
    """Raised when an order requests more stock than currently available in inventory."""
    def __init__(self, message, sku=None, available=0, requested=0):
        super().__init__(message)
        self.sku = sku
        self.available = available
        self.requested = requested


def create_order(customer_id: str, items: list, tax_rate_val: float, user_id: str) -> Order:
    """
    Creates a multi-line customer order inside an isolated ACID database transaction.
    Enforces anti-overselling via pessimistic row-level locking (SELECT ... FOR UPDATE).
    If any requested item exceeds available inventory, the entire transaction is rolled back.
    """
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        raise ValueError("Invalid or inactive customer.")

    if not items:
        raise ValueError("Order must contain at least one line item.")

    # 1. Sort line items by product_id to ensure a deterministic locking order and prevent deadlocks
    sorted_items = sorted(items, key=lambda x: str(x.get("product_id")))

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y%m%d")
    short_code = uuid.uuid4().hex[:6].upper()
    count = Order.query.filter(Order.order_number.like(f"ORD-{date_str}-%")).count()
    order_number = f"ORD-{date_str}-{count + 1:04d}-{short_code}"

    tax_rate = Decimal(str(tax_rate_val if tax_rate_val is not None else "0.0000"))
    if tax_rate < 0 or tax_rate > 1:
        raise ValueError("Tax rate must be between 0.00 and 1.00 (e.g. 0.05 for 5%).")

    subtotal = Decimal("0.00")
    line_items_data = []

    # 2. Acquire exclusive pessimistic row locks on each product and validate availability
    for item_data in sorted_items:
        product_id = item_data.get("product_id")
        try:
            quantity = int(item_data.get("quantity", 0))
        except (ValueError, TypeError):
            raise ValueError(f"Invalid quantity for product {product_id}.")

        if quantity <= 0:
            raise ValueError(f"Quantity must be greater than zero for all line items.")

        # Exclusive row-level lock on the product
        product = db.session.query(Product).filter_by(id=product_id).with_for_update().first()
        if not product or not product.is_active:
            raise ValueError(f"Product '{product_id}' was not found or has been deactivated.")

        # Check in-memory stock first
        if product.current_stock < quantity:
            raise InsufficientStockException(
                f"Insufficient stock for '{product.name}' (SKU: {product.sku}). "
                f"Available: {product.current_stock}, Requested: {quantity}",
                sku=product.sku,
                available=product.current_stock,
                requested=quantity,
            )

        # Deduct in object
        product.current_stock -= quantity

        unit_price = product.unit_price
        item_total = unit_price * quantity
        subtotal += item_total

        line_items_data.append({
            "product_id": product.id,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": item_total,
            "cost_price": product.cost_price,
        })

    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    # 3. Create the order with all calculated totals in one atomic insertion
    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        status="CONFIRMED",
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        created_by=user_id,
        created_at=now,
    )
    db.session.add(order)
    db.session.flush()

    for li in line_items_data:
        order_item = OrderItem(
            order_id=order.id,
            product_id=li["product_id"],
            quantity=li["quantity"],
            unit_price=li["unit_price"],
            total_price=li["total_price"],
        )
        db.session.add(order_item)

        movement = StockMovement(
            product_id=li["product_id"],
            movement_type="ORDER_DEDUCT",
            quantity_delta=-li["quantity"],
            reference_type="ORDER",
            reference_id=order.id,
            unit_cost=li["cost_price"],
            notes=f"Deducted for order {order_number}",
            created_by=user_id,
            created_at=now,
        )
        db.session.add(movement)

    audit = AuditLog(
        user_id=user_id,
        action="ORDER_CREATED",
        entity_type="ORDER",
        entity_id=order.id,
        details={
            "order_number": order_number,
            "total_amount": str(total_amount),
            "item_count": len(line_items_data),
        },
    )
    db.session.add(audit)

    # Serialize order dict while active in transaction before commit expires attributes
    order_data = order.to_dict()

    db.session.commit()
    return order, order_data


def cancel_order(order_id: str, reason: str, user_id: str) -> Order:
    """
    Cancels an order and atomically restores inventory back to active stock
    inside an isolated database transaction, recording ORDER_RESTOCK movements.
    """
    order = db.session.query(Order).filter_by(id=order_id).with_for_update().first()
    if not order:
        raise ValueError("Order not found.")

    if order.status == "CANCELLED":
        raise ValueError("Order is already cancelled.")

    now = datetime.now(timezone.utc)

    # Restock each line item
    for item in order.items:
        product = db.session.query(Product).filter_by(id=item.product_id).with_for_update().first()
        if product:
            product.current_stock += item.quantity

            movement = StockMovement(
                product_id=product.id,
                movement_type="ORDER_RESTOCK",
                quantity_delta=item.quantity,
                reference_type="ORDER",
                reference_id=order.id,
                unit_cost=product.cost_price,
                notes=f"Restocked upon cancellation of order {order.order_number}. Reason: {reason or 'None'}",
                created_by=user_id,
                created_at=now,
            )
            db.session.add(movement)

    order.status = "CANCELLED"
    order.updated_at = now

    audit = AuditLog(
        user_id=user_id,
        action="ORDER_CANCELLED",
        entity_type="ORDER",
        entity_id=order.id,
        details={"order_number": order.order_number, "reason": reason},
    )
    db.session.add(audit)

    # Serialize order dict while active in transaction before commit expires attributes
    order_data = order.to_dict()

    db.session.commit()
    return order, order_data
