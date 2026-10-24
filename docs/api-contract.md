# StockPilot - REST API Contract Specification

**Course:** CSC418 DevOps for Cloud Computing  
**System:** StockPilot REST API  
**Base URL:** `/api`  
**Data Format:** JSON (`application/json`)  
**Version:** 1.0.0  

---

## 1. Protocol Standards & Envelope Structure

All API responses strictly adhere to a predictable JSON envelope structure to streamline frontend consumption and automated testing.

### 1.1 Success Response Envelope
```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 45,
    "total_pages": 5
  }
}
```
*(The `meta` object is included for paginated collections).*

### 1.2 Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for SKU-WIDGET-01. Available: 2, Requested: 5",
    "details": {
      "product_id": "c1f7a4e0-...",
      "available": 2,
      "requested": 5
    }
  }
}
```

### 1.3 Standard HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Malformed JSON or invalid parameter formats.
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks required role permissions.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Business invariant violation (e.g., duplicate SKU, concurrent conflict).
- `422 Unprocessable Entity`: Semantic validation failure (e.g., negative stock adjustment).
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Authentication & User Management Endpoints

### 2.1 Login
- **Endpoint:** `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "AdminPassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "user": {
        "id": "8a3e9c56-...",
        "username": "admin",
        "email": "admin@stockpilot.internal",
        "role": "admin"
      }
    }
  }
  ```

### 2.2 Current User Profile
- **Endpoint:** `GET /api/auth/me`
- **Access:** Authenticated (Admin, Staff)
- **Header:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "8a3e9c56-...",
      "username": "admin",
      "email": "admin@stockpilot.internal",
      "role": "admin"
    }
  }
  ```

---

## 3. Products & Categories Endpoints

### 3.1 List Products
- **Endpoint:** `GET /api/products`
- **Access:** Authenticated (Admin, Staff)
- **Query Parameters:**
  - `page` (integer, default 1)
  - `per_page` (integer, default 10)
  - `search` (string, optional: matches name or SKU)
  - `category_id` (UUID, optional)
  - `low_stock` (boolean, optional: filter where `current_stock <= low_stock_threshold`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "9b12a884-...",
        "sku": "ELEC-LOGI-M100",
        "name": "Logitech Optical Mouse M100",
        "category_id": "4a71b32d-...",
        "category_name": "Electronics",
        "unit_price": "14.99",
        "cost_price": "8.50",
        "current_stock": 25,
        "low_stock_threshold": 10,
        "is_active": true,
        "created_at": "2026-10-24T10:00:00Z"
      }
    ],
    "meta": { "page": 1, "per_page": 10, "total": 1, "total_pages": 1 }
  }
  ```

### 3.2 Create Product
- **Endpoint:** `POST /api/products`
- **Access:** Admin Only
- **Request Body:**
  ```json
  {
    "sku": "ELEC-KEY-K120",
    "name": "Logitech Keyboard K120",
    "description": "Standard USB corded keyboard",
    "category_id": "4a71b32d-...",
    "unit_price": "19.99",
    "cost_price": "11.20",
    "initial_stock": 50,
    "low_stock_threshold": 15
  }
  ```
- **Response (201 Created):** Returns created product entity with stock movement logged.
- **Conflict (409 Conflict):**
  ```json
  {
    "success": false,
    "error": { "code": "DUPLICATE_SKU", "message": "Product with SKU 'ELEC-KEY-K120' already exists." }
  }
  ```

---

## 4. Inbound Stock Receipts & Adjustments

### 4.1 Create Stock Receipt (Inbound from Supplier)
- **Endpoint:** `POST /api/stock/receipts`
- **Access:** Authenticated (Admin, Staff)
- **Request Body:**
  ```json
  {
    "supplier_id": "3d5f8a12-...",
    "receipt_number": "REC-20261024-001",
    "notes": "Weekly inventory restock delivery",
    "items": [
      {
        "product_id": "9b12a884-...",
        "quantity": 100,
        "unit_cost": "8.25"
      }
    ]
  }
  ```
- **Response (201 Created):** Atomically increments product stock, writes to `stock_movements`, and returns receipt details.

### 4.2 Adjust Stock (Damage, Loss, Correction)
- **Endpoint:** `POST /api/stock/adjustments`
- **Access:** Admin Only
- **Request Body:**
  ```json
  {
    "product_id": "9b12a884-...",
    "reason": "DAMAGED",
    "quantity_delta": -3,
    "notes": "Dropped in warehouse during sorting"
  }
  ```
- **Response (201 Created):** Decrements stock by 3 and appends `ADJUSTMENT` movement record.
- **Error (422 Unprocessable Entity):** Returns error if `current_stock + quantity_delta < 0`.

---

## 5. Orders & Anti-Overselling Checkout

### 5.1 Place Customer Order
- **Endpoint:** `POST /api/orders`
- **Access:** Authenticated (Admin, Staff)
- **Request Body:**
  ```json
  {
    "customer_id": "2b99cc11-...",
    "tax_rate": "0.05",
    "items": [
      {
        "product_id": "9b12a884-...",
        "quantity": 5
      }
    ]
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "order_number": "ORD-20261024-1001",
      "status": "CONFIRMED",
      "subtotal": "74.95",
      "tax_amount": "3.75",
      "total_amount": "78.70",
      "items": [
        {
          "product_id": "9b12a884-...",
          "quantity": 5,
          "unit_price": "14.99",
          "total_price": "74.95"
        }
      ]
    }
  }
  ```
- **Anti-Oversell Error (409 Conflict):**
  ```json
  {
    "success": false,
    "error": {
      "code": "INSUFFICIENT_STOCK",
      "message": "Insufficient stock for 'Logitech Optical Mouse M100'. Available: 2, Requested: 5"
    }
  }
  ```

### 5.2 Transition Order Status (Cancel & Restock)
- **Endpoint:** `PUT /api/orders/:id/status`
- **Access:** Admin Only
- **Request Body:**
  ```json
  {
    "status": "CANCELLED",
    "reason": "Customer cancellation request prior to dispatch"
  }
  ```
- **Response (200 OK):** Restores inventory back to active stock atomically and appends `ORDER_RESTOCK` to ledger.

---

## 6. Dashboard & Health Check Endpoints

### 6.1 Dashboard Statistics
- **Endpoint:** `GET /api/dashboard/stats`
- **Access:** Authenticated
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "total_inventory_value": "12540.50",
      "total_active_products": 42,
      "low_stock_count": 3,
      "out_of_stock_count": 1,
      "total_orders_today": 14,
      "total_revenue_today": "1840.20",
      "recent_movements": [ ... ]
    }
  }
  ```

### 6.2 Health Check (AWS ALB & Docker Probe)
- **Endpoint:** `GET /api/health`
- **Access:** Public (Unauthenticated)
- **Response (200 OK):**
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2026-10-24T14:50:00Z"
  }
  ```
  *(If database connection fails, returns `503 Service Unavailable` with `database: "disconnected"`).*
