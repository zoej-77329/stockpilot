import click
from decimal import Decimal
from flask.cli import with_appcontext
from app.extensions import db
from app.models.user import User
from app.models.category import Category
from app.models.supplier import Supplier
from app.models.customer import Customer
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.audit_log import AuditLog


@click.command("seed")
@with_appcontext
def seed_data():
    """
    Safely seeds initial database records for development and testing.
    Never overwrites or deletes existing production data.
    """
    # 1. Idempotency Check: Exit safely if database is already seeded
    existing_admin = User.query.filter_by(username="admin").first()
    if existing_admin:
        click.echo("Safe Seed: Database is already initialized. Skipping seed to prevent data overwrite.")
        return

    click.echo("Seeding StockPilot initial data...")

    # 2. Users (Admin and Staff)
    admin_user = User(
        username="admin",
        email="admin@stockpilot.internal",
        role="admin",
        is_active=True,
    )
    admin_user.set_password("AdminPassword123!")

    staff_user = User(
        username="staff",
        email="staff@stockpilot.internal",
        role="staff",
        is_active=True,
    )
    staff_user.set_password("StaffPassword123!")

    db.session.add_all([admin_user, staff_user])
    db.session.flush()

    # 3. Categories
    cat_elec = Category(name="Electronics", description="Consumer electronics, peripherals, and cables")
    cat_off = Category(name="Office Supplies", description="Paper, notebooks, writing instruments, and desk organizers")
    cat_pack = Category(name="Packaging", description="Corrugated boxes, bubble mailers, and sealing tape")

    db.session.add_all([cat_elec, cat_off, cat_pack])
    db.session.flush()

    # 4. Suppliers
    sup_apex = Supplier(
        name="Apex Components Ltd.",
        contact_name="Alice Chen",
        email="sales@apexcomponents.com",
        phone="+1-555-0101",
        address="104 Industrial Parkway, Silicon Valley, CA",
    )
    sup_global = Supplier(
        name="Global Office Direct",
        contact_name="Bob Miller",
        email="orders@globalofficedirect.com",
        phone="+1-555-0102",
        address="55 Supply Chain Road, Chicago, IL",
    )

    db.session.add_all([sup_apex, sup_global])
    db.session.flush()

    # 5. Customers
    cust_acme = Customer(
        name="Acme Corporation",
        email="procurement@acme.com",
        phone="+1-555-0201",
        address="100 Enterprise Way, Suite 400, Austin, TX",
    )
    cust_star = Customer(
        name="Starlight Logistics",
        email="purchasing@starlight.com",
        phone="+1-555-0202",
        address="75 Commerce Blvd, Seattle, WA",
    )

    db.session.add_all([cust_acme, cust_star])
    db.session.flush()

    # 6. Products (including low-stock and out-of-stock items for alert validation)
    products_data = [
        {
            "sku": "ELEC-MOU-100",
            "name": "Wireless Ergonomic Mouse",
            "description": "2.4GHz optical mouse with silent click buttons",
            "category_id": cat_elec.id,
            "unit_price": Decimal("29.99"),
            "cost_price": Decimal("14.50"),
            "current_stock": 45,
            "low_stock_threshold": 10,
        },
        {
            "sku": "ELEC-KEY-200",
            "name": "Mechanical Tenkeyless Keyboard",
            "description": "RGB tactile mechanical switch keyboard with detachable cable",
            "category_id": cat_elec.id,
            "unit_price": Decimal("89.99"),
            "cost_price": Decimal("48.00"),
            "current_stock": 25,
            "low_stock_threshold": 8,
        },
        {
            "sku": "OFF-PAP-500",
            "name": "Multipurpose Copy Paper (500 Sheets)",
            "description": "20lb standard letter size 8.5 x 11 bright white paper",
            "category_id": cat_off.id,
            "unit_price": Decimal("8.50"),
            "cost_price": Decimal("4.20"),
            "current_stock": 120,
            "low_stock_threshold": 30,
        },
        {
            "sku": "ELEC-USB-064",
            "name": "High-Speed USB-C Flash Drive 64GB",
            "description": "Dual USB-A and USB-C ultra-compact flash storage",
            "category_id": cat_elec.id,
            "unit_price": Decimal("15.99"),
            "cost_price": Decimal("7.80"),
            "current_stock": 4,  # Triggers low stock alert (<= 10)
            "low_stock_threshold": 10,
        },
        {
            "sku": "OFF-PEN-012",
            "name": "Gel Ink Rollerball Pens (Pack of 12)",
            "description": "0.7mm smooth black ink pens",
            "category_id": cat_off.id,
            "unit_price": Decimal("12.00"),
            "cost_price": Decimal("5.50"),
            "current_stock": 0,  # Critical Out-of-Stock demonstration
            "low_stock_threshold": 15,
        },
    ]

    for p_info in products_data:
        prod = Product(**p_info)
        db.session.add(prod)
        db.session.flush()

        if prod.current_stock > 0:
            movement = StockMovement(
                product_id=prod.id,
                movement_type="RECEIPT",
                quantity_delta=prod.current_stock,
                reference_type="SEED",
                reference_id=prod.id,
                unit_cost=prod.cost_price,
                notes="Initial inventory baseline load",
                created_by=admin_user.id,
            )
            db.session.add(movement)

    audit = AuditLog(
        user_id=admin_user.id,
        action="DATABASE_SEEDED",
        entity_type="SYSTEM",
        details={"seed_type": "initial_development_data"},
    )
    db.session.add(audit)

    db.session.commit()
    click.echo("Seeding completed successfully!")
