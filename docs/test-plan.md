# StockPilot - Comprehensive Test Plan

**Course:** CSC418 DevOps for Cloud Computing  
**System:** StockPilot Inventory & Order Management System  
**Test Frameworks:** Pytest (Backend & Concurrency) + Selenium WebDriver (Browser E2E)  
**Version:** 1.0.0  

---

## 1. Test Strategy & Quality Pyramid

To guarantee compliance with the CSC418 exam rubric, StockPilot utilizes a three-tiered automated testing pyramid:

```
                  ┌──────────────────────┐
                  │   Selenium E2E Tests │
                  │  (Browser Automation │
                  │   & Evidence Capture)│
                  ├──────────────────────┤
                  │   Integration Tests  │
                  │ (API + Concurrency   │
                  │  & DB Transactions)  │
                  ├──────────────────────┤
                  │     Unit Tests       │
                  │ (Models, Schemas,    │
                  │  Password Security)  │
                  └──────────────────────┘
```

1. **Unit Testing:** Validates bcrypt password hashing, payload validation rules, and model instance behavior without external dependencies.
2. **Integration & Concurrency Testing:** Executes against a real PostgreSQL test database to verify foreign key constraints, rollback behaviors, and pessimistic locking during race conditions.
3. **End-to-End (E2E) Browser Testing:** Drives real Chrome browser sessions using Selenium WebDriver, validating responsive UI rendering, authentication flows, stock movements, and automatically capturing timestamped screenshots into `evidence/`.

---

## 2. Integration & Concurrency Test Matrix

### 2.1 Concurrency & Anti-Overselling Test
- **Test ID:** `TEST-INT-001`
- **File:** `tests/backend/test_concurrency.py`
- **Objective:** Prove that two concurrent checkout requests competing for the exact same remaining inventory cannot oversell stock.
- **Scenario:**
  - Product `TEST-SKU-LIMITED` has initial stock = 1.
  - Two parallel threads submit order requests simultaneously for quantity = 1.
- **Assertion:** Exactly ONE thread succeeds (`201 Created`); the other thread fails with `409 Conflict` (`INSUFFICIENT_STOCK`). Final inventory in PostgreSQL must be exactly 0, never -1.

### 2.2 Transaction Rollback Verification
- **Test ID:** `TEST-INT-002`
- **File:** `tests/backend/test_orders.py`
- **Objective:** Verify that failure during any line item of a multi-item order aborts the entire transaction.
- **Scenario:** Order contains Item A (in stock, quantity 2) and Item B (out of stock, quantity 10).
- **Assertion:** API returns `409 Conflict`. Stock for Item A remains unchanged. Zero order or movement records are persisted.

### 2.3 Order Cancellation & Stock Restoration
- **Test ID:** `TEST-INT-003`
- **File:** `tests/backend/test_orders.py`
- **Objective:** Validate inventory restock logic on administrative order cancellation.
- **Scenario:** Order for 5 units is placed (stock drops from 20 to 15). Admin cancels order.
- **Assertion:** Product stock returns to 20. Movement ledger records an `ORDER_RESTOCK` entry with `quantity = +5`.

---

## 3. Selenium WebDriver End-to-End Test Matrix

All Selenium tests are located in `tests/selenium/` and can execute in both headless mode (for CI/CD and containers) and headed mode (for visual inspection). Each test step takes a screenshot on success or failure, saving directly to `evidence/`.

| Test ID | Test Name | Key Steps Executed | Expected Outcome & Screenshot |
| :--- | :--- | :--- | :--- |
| **TC-E2E-01** | `test_login_flow` | 1. Navigate to `/login`.<br>2. Submit invalid password.<br>3. Verify error alert.<br>4. Enter valid Admin credentials. | User redirected to `/dashboard`. Screenshot: `evidence/03_e2e_login_success.png`. |
| **TC-E2E-02** | `test_product_creation` | 1. Go to `/products`.<br>2. Open "Add Product" modal.<br>3. Fill details (SKU: `E2E-PROD-01`, Stock: 20).<br>4. Save. | Product listed in table. Screenshot: `evidence/04_e2e_product_created.png`. |
| **TC-E2E-03** | `test_duplicate_sku` | 1. Attempt creating product with existing SKU `E2E-PROD-01`. | Validation error banner displayed ("SKU already exists"). Screenshot: `evidence/05_e2e_duplicate_sku_rejection.png`. |
| **TC-E2E-04** | `test_stock_receipt` | 1. Navigate to `/stock/receipts`.<br>2. Record inbound receipt for 30 units of `E2E-PROD-01`. | Stock increases from 20 to 50 in real-time. Screenshot: `evidence/06_e2e_stock_receipt_added.png`. |
| **TC-E2E-05** | `test_order_checkout` | 1. Go to `/orders/new`.<br>2. Select customer and product `E2E-PROD-01` (Qty: 10).<br>3. Submit order. | Order created (`ORD-...`). Stock decrements to 40. Screenshot: `evidence/07_e2e_order_placed.png`. |
| **TC-E2E-06** | `test_oversell_rejection`| 1. Create order for 100 units of `E2E-PROD-01` (available: 40).<br>2. Submit order. | Modal warning: "Insufficient Stock". Order blocked. Screenshot: `evidence/08_e2e_oversell_blocked.png`. |
| **TC-E2E-07** | `test_low_stock_alert` | 1. Adjust stock of product to 3 units (threshold = 10).<br>2. Inspect dashboard. | Amber Low-Stock banner and alert pill rendered. Screenshot: `evidence/09_e2e_low_stock_alert.png`. |

---

## 4. Docker Volume Persistence Verification Test

- **Test ID:** `TEST-OPS-001`
- **Objective:** Fulfill CSC418 requirement: prove PostgreSQL data persistence across container deletion and recreation.
- **Verification Procedure:**
  ```bash
  # Step 1: Start containers with Docker Compose
  docker compose up -d

  # Step 2: Seed or create a test product via API
  curl -X POST http://localhost:5000/api/products \
    -H "Authorization: Bearer <ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"sku":"PERSIST-01","name":"Persistent Test Item","unit_price":25.00,"cost_price":15.00,"initial_stock":100}'

  # Step 3: Tear down all running containers
  docker compose down

  # Step 4: Verify containers are destroyed
  docker ps -a | grep stockpilot

  # Step 5: Start containers back up
  docker compose up -d

  # Step 6: Query database to confirm data survived container recreation
  docker compose exec postgres psql -U stockpilot_user -d stockpilot -c "SELECT sku, name, current_stock FROM products WHERE sku='PERSIST-01';"
  ```
- **Evidence Output:** Recorded in `evidence/02_named_volume_persistence.png` showing the exact SQL output proving data survived.

---

## 5. Test Execution Commands

```bash
# 1. Run Backend Unit & Integration Tests (including Concurrency)
pytest tests/backend/ -v --tb=short

# 2. Run Selenium Browser Tests in Headless Mode (Generates Screenshots)
pytest tests/selenium/ -v --headless

# 3. Run Selenium in Headed Mode (Opens Chrome Window for Live Demo)
pytest tests/selenium/ -v
```
