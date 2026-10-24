# StockPilot - Architecture Specification

**Course:** CSC418 DevOps for Cloud Computing  
**System:** StockPilot Inventory & Order Management System  
**Version:** 1.0.0  

---

## 1. Architectural Philosophy & Strategy

StockPilot is architected as a modern, decoupled three-tier application designed for high availability, transactional integrity, and containerized cloud deployment:
1. **Presentation Tier:** React Single Page Application (SPA) built with TypeScript and Vite, served via an optimized Nginx web server acting as a reverse proxy.
2. **Application Tier:** Python Flask RESTful API running on Gunicorn WSGI server, implementing domain business logic, cryptographic authentication, and strict schema validation.
3. **Data Tier:** PostgreSQL relational database engine enforcing relational constraints, ACID transactions, and row-level locking for inventory operations.

The system is deliberately structured to run identically in two environments:
- **Local Dev / Test:** Docker Compose with three communicating containers (`frontend`, `backend`, `postgres`) connected over a private bridge network with a named volume (`stockpilot_pgdata`).
- **AWS Production:** Two EC2 application instances managed by an Auto Scaling Group (ASG) behind an Application Load Balancer (ALB), connected to a centralized Amazon RDS PostgreSQL instance.

---

## 2. High-Level Architecture Diagrams

### 2.1 Local Docker Development Topology

```
                     Host Browser (Developer / Selenium)
                                      │
                                      ▼ Port 80 / 3000
               ┌──────────────────────────────────────────────┐
               │         Docker Bridge Network                │
               │           (stockpilot-net)                   │
               │                                              │
               │  ┌────────────────────────────────────────┐  │
               │  │  Container: stockpilot-frontend        │  │
               │  │  Image: stockpilot-web:latest          │  │
               │  │  - Nginx 1.25 Alpine                   │  │
               │  │  - Serves static compiled React SPA    │  │
               │  │  - Reverse proxies /api/* to backend   │  │
               │  └───────────────────┬────────────────────┘  │
               │                      │                       │
               │                      │ http://backend:5000   │
               │                      ▼                       │
               │  ┌────────────────────────────────────────┐  │
               │  │  Container: stockpilot-backend         │  │
               │  │  Image: stockpilot-api:latest          │  │
               │  │  - Python 3.11 Alpine / Slim           │  │
               │  │  - Gunicorn WSGI + Flask REST API      │  │
               │  │  - Runs as non-root user 'appuser'     │  │
               │  └───────────────────┬────────────────────┘  │
               │                      │                       │
               │                      │ postgresql://...:5432 │
               │                      ▼                       │
               │  ┌────────────────────────────────────────┐  │
               │  │  Container: stockpilot-postgres        │  │
               │  │  Image: postgres:16-alpine             │  │
               │  │  - Relational Database Engine          │  │
               │  └───────────────────┬────────────────────┘  │
               └──────────────────────┼───────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Docker Named Volume       │
                        │ (stockpilot_pgdata)       │
                        │ /var/lib/postgresql/data  │
                        └───────────────────────────┘
```

### 2.2 AWS Production Architecture (Exam Rubric Compliant)

```
                              Internet
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │  AWS Application Load Balancer│
                 │  (ALB) - Public Subnets       │
                 │  - Port 80 / 443 Listener     │
                 │  - Round-Robin Distribution   │
                 └───────────────┬───────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           │ Target Group: stockpilot-tg               │
           │ Health Check: GET /api/health (HTTP 200)  │
           └─────────────────────┬─────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           │ AWS Auto Scaling Group (ASG)              │
           │ Desired: 2 | Min: 2 | Max: 3              │
           │ Multi-AZ: us-east-1a & us-east-1b         │
           ├─────────────────────────┬─────────────────┤
           ▼                         ▼                 ▼
 ┌───────────────────┐     ┌───────────────────┐  [Scale-Out]
 │  EC2 Instance 1   │     │  EC2 Instance 2   │
 │ (Public / Private)│     │ (Public / Private)│
 │ ┌───────────────┐ │     │ ┌───────────────┐ │
 │ │ Docker Engine │ │     │ │ Docker Engine │ │
 │ │ - Frontend    │ │     │ │ - Frontend    │ │
 │ │ - Backend API │ │     │ │ - Backend API │ │
 │ └───────────────┘ │     │ └───────────────┘ │
 └─────────┬─────────┘     └─────────┬─────────┘
           │                         │
           └────────────┬────────────┘
                        │
                        ▼ Port 5432
           ┌─────────────────────────┐
           │ Amazon RDS PostgreSQL   │
           │ (Multi-AZ / Single-AZ)  │
           │ - Shared DB Engine      │
           │ - Automated Backups     │
           │ - Persistent EBS Volume │
           └─────────────────────────┘
```

---

## 3. Component Details & Design Choices

### 3.1 Frontend Tier (Client Application)
- **Framework:** React 18 with TypeScript for type-safety and developer productivity.
- **Build Tool:** Vite for lightning-fast Hot Module Replacement (HMR) and optimized production minification.
- **Styling:** Tailwind CSS for a professional, responsive dashboard design without bloated UI libraries.
- **State Management & Routing:** 
  - React Router v6 for client-side routing, protected routes (`<ProtectedRoute role="admin" />`), and clean URL handling.
  - Context API / Custom Hooks for authentication tokens and user session state.
- **HTTP Client:** Fetch wrapper with request interceptors attaching `Authorization: Bearer <token>` and standardized error toast notifications.
- **Production Web Server:** Nginx 1.25 Alpine serves compiled static assets with gzip compression, caching headers, and reverse proxies `/api/*` requests directly to the backend service. This eliminates CORS complications in both local Docker and production environments.

### 3.2 Backend Tier (API & Domain Logic)
- **Language & Runtime:** Python 3.11 with virtual environment or container isolation.
- **Framework:** Flask 3.x lightweight microframework chosen for clean architectural transparency without unnecessary monolithic magic.
- **WSGI Production Server:** Gunicorn with 4 gevent or sync worker processes handling concurrent HTTP connections.
- **Security & Authorization:**
  - Password hashing: `bcrypt` algorithm.
  - Authentication: `Flask-JWT-Extended` generating stateless, signed JWTs.
  - Role-based authorization: custom decorator `@role_required(['admin'])`.
- **Database Abstraction & Migrations:**
  - `SQLAlchemy 2.x` ORM for object mapping and query generation.
  - `Flask-Migrate` (powered by Alembic) for reproducible, version-controlled database schema migrations.
- **Validation:** Marshmallow / Pydantic schemas validating inbound request payloads (types, string lengths, positive quantities, non-empty fields).

### 3.3 Database Tier (Persistence & ACID Guarantees)
- **Database Engine:** PostgreSQL 16.
- **Monetary Precision:** Currency values (prices, totals, costs) are stored strictly as `NUMERIC(12, 2)` to eliminate standard IEEE-754 floating-point errors.
- **Stock Quantities:** Stored as `INTEGER` with check constraints (`CHECK (current_stock >= 0)`) guaranteeing that negative stock can never be persisted under any circumstance.
- **Local Persistence:** Configured in `docker-compose.yml` with a named volume `stockpilot_pgdata` mapping to `/var/lib/postgresql/data`.
- **AWS Persistence:** Centralized Amazon RDS PostgreSQL (db.t4g.micro or db.t3.micro) shared by all EC2 instances in the Auto Scaling Group.

---

## 4. Concurrency Protection & Anti-Overselling Design

In high-concurrency e-commerce and inventory workflows, two concurrent orders can read the same available stock (e.g., 1 unit remaining) simultaneously and both succeed, leading to negative inventory (overselling).

StockPilot resolves this using **Pessimistic Row-Level Locking**:

```python
# Conceptual transaction flow in StockPilot Order Service
@db.transactional
def create_order(customer_id, items, user_id):
    # 1. Sort product IDs to prevent database deadlocks
    sorted_items = sorted(items, key=lambda x: x['product_id'])
    
    # 2. Acquire exclusive row lock on requested products
    product_ids = [item['product_id'] for item in sorted_items]
    locked_products = db.session.query(Product)\
        .filter(Product.id.in_(product_ids))\
        .with_for_update()\
        .all()
    
    product_map = {p.id: p for p in locked_products}
    
    # 3. Validate stock levels atomically
    for item in sorted_items:
        product = product_map[item['product_id']]
        if product.current_stock < item['quantity']:
            # Entire transaction aborts and rolls back
            raise InsufficientStockError(
                f"Insufficient stock for {product.name} (SKU: {product.sku}). "
                f"Available: {product.current_stock}, Requested: {item['quantity']}"
            )
            
    # 4. Deduct stock and log movements
    order = Order(customer_id=customer_id, user_id=user_id, status='CONFIRMED')
    db.session.add(order)
    db.session.flush() # obtain order.id
    
    for item in sorted_items:
        product = product_map[item['product_id']]
        product.current_stock -= item['quantity']
        
        # Line item
        db.session.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item['quantity'],
            unit_price=product.unit_price
        ))
        
        # Append to immutable movement ledger
        db.session.add(StockMovement(
            product_id=product.id,
            movement_type='ORDER_DEDUCT',
            quantity=-item['quantity'],
            reference_type='ORDER',
            reference_id=order.id,
            created_by=user_id
        ))
        
    db.session.commit()
    return order
```

---

## 5. Directory & File Layout (Monorepo)

```
D:\Stockpilot\
├── .gitignore
├── README.md
├── docker-compose.yml              # Local multi-container development definition
├── docker-compose.prod.yml         # Production container definition (uses RDS)
│
├── backend/                        # Python Flask REST API
│   ├── Dockerfile                  # Multi-stage custom Dockerfile (non-root user)
│   ├── requirements.txt            # Python dependencies (Flask, SQLAlchemy, etc.)
│   ├── wsgi.py                     # Entry point for Gunicorn
│   ├── app/
│   │   ├── __init__.py             # Flask factory & extension initialization
│   │   ├── config.py               # Environment configuration (Dev, Test, Prod)
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── product.py
│   │   │   ├── order.py
│   │   │   └── audit.py
│   │   ├── routes/                 # Blueprints & REST endpoints
│   │   │   ├── auth.py
│   │   │   ├── products.py
│   │   │   ├── orders.py
│   │   │   ├── stock.py
│   │   │   └── dashboard.py
│   │   ├── services/               # Business logic & transactional operations
│   │   │   ├── order_service.py
│   │   │   └── stock_service.py
│   │   └── utils/                  # Decorators, schemas, formatters
│   └── migrations/                 # Alembic migration scripts
│
├── frontend/                       # React 18 + TypeScript + Vite SPA
│   ├── Dockerfile                  # Multi-stage build (Node -> Nginx Alpine)
│   ├── nginx.conf                  # Nginx reverse proxy configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                    # Centralized API client functions
│       ├── components/             # Reusable UI components (Navbar, Modal, Tables)
│       └── pages/                  # Route views (Dashboard, Products, Orders, Login)
│
├── tests/                          # Automated Testing Suite
│   ├── backend/                    # Pytest unit & integration tests
│   │   ├── conftest.py             # Database fixtures & test client
│   │   ├── test_auth.py
│   │   ├── test_products.py
│   │   └── test_concurrency.py     # Race-condition & overselling tests
│   └── selenium/                   # Selenium WebDriver E2E UI tests
│       ├── conftest.py             # WebDriver fixture (Chrome headless/headed)
│       ├── test_e2e_login.py
│       └── test_e2e_workflow.py    # Complete inventory order lifecycle
│
├── docs/                           # Project Planning & Architecture Documentation
│   ├── requirements.md
│   ├── architecture.md
│   ├── database-design.md
│   ├── api-contract.md
│   ├── test-plan.md
│   ├── aws-deployment-plan.md
│   └── exam-evidence-checklist.md
│
└── evidence/                       # Generated screenshots, logs & exam artifacts
    ├── 01_docker_compose_up.png
    ├── 02_named_volume_persistence.png
    └── ...
```
