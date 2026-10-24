# StockPilot - Requirements Specification

**Course:** CSC418 DevOps for Cloud Computing (Lab Exam Project)  
**System:** StockPilot - Intermediate Inventory & Order Management System  
**Stack:** React + TypeScript + Vite | Python Flask REST API | PostgreSQL | Docker Compose | AWS ALB + ASG + EC2 + RDS  
**Version:** 1.0.0  

---

## 1. Overview & Project Purpose

StockPilot is an intermediate-complexity, production-ready Inventory and Order Management System specifically engineered to satisfy the rigorous technical, architectural, and operational requirements of the CSC418 DevOps for Cloud Computing lab examination.

Unlike static demonstrations, mock prototypes, or toy apps, StockPilot provides a complete, robust, full-stack transactional workflow. It enforces strict ACID guarantees on all inventory movements, validates business invariants at the database engine level, prevents stock overselling using database-level pessimistic locking, and deploys as a cloud-native architecture across both local Docker multi-container environments and an AWS High Availability (HA) infrastructure.

---

## 2. User Roles & Permission Matrix

StockPilot implements Role-Based Access Control (RBAC) enforced on the server-side via cryptographic JSON Web Tokens (JWT) and database user validation. Client-side navigation guards reflect these permissions, but all authorization is strictly enforced at the API layer.

| Feature / Operation | Admin Role | Staff Role | Unauthenticated |
| :--- | :---: | :---: | :---: |
| **User Authentication (Login / Logout / Verify)** | Allowed | Allowed | Login Only |
| **User Management (View, Create, Deactivate)** | Full Control | Denied (403 Forbidden) | Denied (401 Unauthorized) |
| **Category Management (Create, Update, Delete)** | Full Control | Read-Only (GET) | Denied |
| **Product Management (Create, Edit, Reorder Levels)** | Full Control | Read-Only (GET) | Denied |
| **Supplier Directory (Create, Update, View)** | Full Control | Read-Only (GET) | Denied |
| **Customer Directory (Create, Update, View)** | Full Control | Full Control | Denied |
| **Stock Receipts (Record Inbound Shipments)** | Allowed | Allowed | Denied |
| **Stock Adjustments (Damage, Loss, Correction)** | Allowed | Denied (Admin Only) | Denied |
| **Customer Orders (Create, View)** | Allowed | Allowed | Denied |
| **Order Status Transitions (Cancel / Restock)** | Allowed | Denied (Admin Only) | Denied |
| **Stock Movement Ledger (Audit Trail)** | Read-Only (Append by system) | Read-Only (Append by system) | Denied |
| **Audit Logs (Security & Access Events)** | Full Access | Denied (403 Forbidden) | Denied |
| **Financial & Inventory Dashboard Analytics** | Full Metrics | Operational Metrics | Denied |

---

## 3. Detailed Functional Requirements (FR)

### FR-1: Authentication & Session Security
- **FR-1.1 Password Security:** User passwords must be hashed using `bcrypt` with a minimum salt work factor of 12 before being stored. Plaintext passwords must never be logged or persisted.
- **FR-1.2 Token Generation:** Upon successful authentication (`/api/auth/login`), the API issues a signed JSON Web Token containing the user's ID, role, and expiration timestamp (default 8 hours).
- **FR-1.3 Zero-Trust RBAC Decorators:** All protected endpoints must be wrapped with custom Flask decorators (`@jwt_required` and `@role_required(['admin'])`). Requests lacking valid tokens receive `401 Unauthorized`; requests with insufficient privileges receive `403 Forbidden`.
- **FR-1.4 Identity Inspection:** A dedicated endpoint (`/api/auth/me`) allows the frontend to retrieve the active session profile on page reload.

### FR-2: Product & Category Catalog Management
- **FR-2.1 Categorization:** Every product must belong to a valid `Category`. Products cannot be orphaned.
- **FR-2.2 SKU Invariant:** Stock Keeping Units (SKU) must be unique system-wide, enforced via a database unique index. Duplicate SKU insertion attempts must return `409 Conflict`.
- **FR-2.3 Product Properties:** Each product maintains an SKU, name, description, category foreign key, cost price, selling price, current stock quantity, and a low-stock threshold.
- **FR-2.4 Soft Deletion:** Products involved in previous orders cannot be deleted from the database. Instead, an `is_active` boolean flag is toggled to false, preventing new orders while preserving historical reporting.

### FR-3: Supplier & Customer Directory Management
- **FR-3.1 Suppliers:** Track supplier name, primary contact person, email address, phone number, and physical address.
- **FR-3.2 Customers:** Track customer legal name, email, phone number, and shipping address.
- **FR-3.3 Referential Integrity:** Deleting a customer or supplier with linked transactions is blocked by foreign key constraints (`RESTRICT` or `NO ACTION`).

### FR-4: Inbound Stock Receipts (Receiving Goods)
- **FR-4.1 Receipt Record:** Inbound inventory from registered suppliers is recorded with a unique receipt number, supplier ID, timestamp, and optional receiver notes.
- **FR-4.2 Multi-Item Inbound:** A receipt supports multiple line items, each specifying product ID, quantity received (positive integer), and unit purchasing cost.
- **FR-4.3 Atomic Stock Increment:** Finalizing a receipt atomically increments the product's `current_stock` and writes an immutable entry into the `stock_movements` ledger with `movement_type = 'RECEIPT'`.

### FR-5: Stock Adjustments (Damage, Loss, Reconciliation)
- **FR-5.1 Purpose:** Correct discrepancy between physical inventory and system counts.
- **FR-5.2 Categorized Reasons:** Mandatory selection of standard reason codes: `DAMAGED`, `LOST`, `EXPIRED`, `PHYSICAL_COUNT_RECONCILIATION`.
- **FR-5.3 Non-Negative Floor Rule:** Negative adjustments (reductions) cannot reduce product stock below zero. An adjustment that would result in negative stock is rejected with `422 Unprocessable Entity`.
- **FR-5.4 Ledger Record:** All adjustments append a `stock_movements` entry with `movement_type = 'ADJUSTMENT'`.

### FR-6: Customer Orders & Cart Line Items
- **FR-6.1 Multi-Line Checkout:** Orders contain one or more line items referencing active products.
- **FR-6.2 Snapshot Pricing:** Each line item stores the historical `unit_price` at the exact moment of order placement, shielding completed orders from subsequent catalog price fluctuations.
- **FR-6.3 Precision Arithmetic:** Line item subtotals, order tax (configurable, default 0%), and grand total are calculated and stored using PostgreSQL `NUMERIC(12, 2)` to eliminate floating-point rounding errors.

### FR-7: Transactional Stock Deduction & Anti-Overselling Engine
- **FR-7.1 Transaction Isolation:** Order creation executes inside an atomic database transaction.
- **FR-7.2 Pessimistic Row Locking:** When checking product availability, the backend executes `SELECT ... FOR UPDATE` ordered by product ID to prevent deadlocks and race conditions from concurrent checkouts.
- **FR-7.3 Atomic Rejection:** If `product.current_stock < requested_quantity` for *any* item in the order, the entire transaction is rolled back immediately with `409 Conflict`, returning a descriptive error message indicating the deficient SKU and available stock.
- **FR-7.4 Ledger Audit:** For successful orders, inventory is deducted immediately and logged in `stock_movements` with `movement_type = 'ORDER_DEDUCT'`.

### FR-8: Order Status Lifecycle & Explicit State Transitions
- **FR-8.1 State Machine:**
  ```
  [PENDING] ──────► [CONFIRMED]
      │                   │
      ▼                   ▼
  [CANCELLED]         [CANCELLED] (Admin Only)
  ```
- **FR-8.2 Stock Restoration on Cancellation:** When an order transitions to `CANCELLED`, all line items are atomically added back to `current_stock` inside an isolated transaction, and ledger entries with `movement_type = 'ORDER_RESTOCK'` are generated.
- **FR-8.3 Immutability:** An order in `CANCELLED` state cannot be transitioned back to `PENDING` or `CONFIRMED`.

### FR-9: Low-Stock Alerts & Dashboard Analytics
- **FR-9.1 Low-Stock Trigger:** A product is flagged as low-stock when `current_stock <= low_stock_threshold`.
- **FR-9.2 Notification Banner:** The web application displays an amber warning banner and badge counter whenever any active product breaches its threshold.
- **FR-9.3 KPI Dashboard Cards:**
  - Total Inventory Valuation (sum of `current_stock * cost_price`).
  - Total Active Products & Categories.
  - Critical Out-of-Stock Items (`current_stock == 0`).
  - Pending & Confirmed Order Counts and Total Revenue.
  - Recent Stock Movements Table.

### FR-10: Immutable Stock Movement Ledger & Audit Logs
- **FR-10.1 Append-Only Ledger:** The `stock_movements` table is strictly append-only. No `UPDATE` or `DELETE` API endpoints exist for movement records.
- **FR-10.2 Audit Logging:** High-privilege administrative actions (user deactivations, role updates, stock adjustments, order cancellations) are recorded in `audit_logs` with actor ID, timestamp, entity type, entity ID, and client IP address.

### FR-11: Search, Filtering, and Server-Side Pagination
- **FR-11.1 Pagination:** All list endpoints (`/api/products`, `/api/orders`, `/api/stock/movements`) accept `page` (default 1) and `per_page` (default 10, max 100) query parameters.
- **FR-11.2 Search & Filtering:** Case-insensitive search on names, SKUs, and order numbers; filter by category, order status, and stock health (e.g., `low_stock=true`).

### FR-12: Modern, Responsive User Interface
- **FR-12.1 State Handling:** Explicit visual spinners/skeletons during data retrieval; informative empty state illustrations when datasets are empty.
- **FR-12.2 Form Validation:** Client-side validation with real-time feedback paired with server-side validation error mapping.
- **FR-12.3 Responsive Layout:** Fully adaptive layout utilizing Tailwind CSS, tested across standard desktop (1920x1080), laptop (1366x768), and mobile screen breakpoints.

---

## 4. CSC418 DevOps Exam Requirements & Constraints

| Exam Requirement | StockPilot Technical Solution | Target Proof / Evidence |
| :--- | :--- | :--- |
| **Custom Docker Image & Dockerfile** | Multi-stage Dockerfile for Flask API (Python 3.11, non-root user `appuser`) and Frontend (Node build + Nginx alpine). | `docker build` output, image inspection showing custom labels and size optimization. |
| **Docker Compose (Communicating Containers)** | `docker-compose.yml` linking `frontend`, `backend`, and `postgres` on a private bridge network `stockpilot-net`. | `docker compose ps`, inter-container DNS ping (`curl backend:5000/api/health`). |
| **Named Persistent Volume** | PostgreSQL container uses named volume `stockpilot_pgdata`. | Data persistence verified across `docker compose down` and `docker compose up -d`. |
| **Linux Administration & Permissions** | Secure non-root container user (`UID 10001`), explicit file ownership (`chown`), read-only root filesystems where practical. | Container user inspection (`id`, `whoami`), process hierarchy (`ps aux`). |
| **Selenium WebDriver Browser Tests** | Automated Python Selenium test suite testing login, product creation, checkout, and negative oversell validation. | Pytest terminal execution log and timestamped screenshot artifacts in `evidence/`. |
| **AWS High Availability Architecture** | 2 EC2 instances running StockPilot behind an Application Load Balancer (ALB) and Auto Scaling Group (ASG). | AWS Console screenshots, target group health checks, curl load balancing round-robin response. |
| **Shared Cloud Database** | Amazon RDS PostgreSQL instance accessible by both EC2 instances within a secure private VPC subnet group. | RDS status in AWS Console, database connection string verification. |
