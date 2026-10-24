# StockPilot - Cloud-Native Inventory & Order Management System

**System:** StockPilot  
**Tech Stack:** React 18 + TypeScript + Vite | Python 3.11 Flask REST API | PostgreSQL 16 | Docker Compose | AWS (ALB + ASG + EC2 + RDS)  

---

## 1. System Overview

StockPilot is an intermediate-complexity, full-stack Inventory and Order Management System :

- **ACID Stock Transactions:** Implements pessimistic row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrent inventory overselling.
- **Strict Role-Based Access Control (RBAC):** Backend-enforced authorization differentiating `admin` and `staff` roles.
- **Containerization & Persistence:** Multi-container Docker Compose with private bridge networking and a PostgreSQL named volume (`stockpilot_pgdata`) with proven persistence across container recreation.
- **Automated Verification:** Pytest backend/concurrency test suite and Selenium WebDriver browser automation with automated screenshot generation into `evidence/`.
- **High-Availability Cloud Architecture:** Ready for AWS deployment across two EC2 instances behind an Application Load Balancer (ALB) and Auto Scaling Group (ASG) with Amazon RDS.

---

## 2. Project Directory Structure

```
D:\Stockpilot\
├── backend/                        # Python Flask REST API
│   ├── app/                        # Application factory, routes, models, extensions
│   ├── Dockerfile                  # Production-ready, non-root user Dockerfile
│   ├── requirements.txt            # Core production dependencies
│   ├── requirements-dev.txt        # Development and testing tools
│   └── wsgi.py                     # Entry point for WSGI/Gunicorn server
├── frontend/                       # React 18 + TypeScript + Vite SPA
├── tests/                          # Automated Testing Suite
│   ├── backend/                    # Pytest unit, integration, and concurrency tests
│   └── selenium/                   # Selenium browser E2E tests
├── docker/                         # Supporting Docker configurations
├── docs/                           # Architecture, DB, API, Test, & AWS Plans
├── evidence/                       # Exam verification screenshots and outputs
├── .env.example                    # Environment configuration template
└── README.md                       # Setup and operational instructions
```

---

## 3. Local Development Setup (Windows PowerShell)

### 3.1 Prerequisites
- Python 3.11+
- Git for Windows
- Docker Desktop with WSL2 backend
- Google Chrome (for Selenium E2E tests)

### 3.2 Step-by-Step Backend Setup

1. **Open PowerShell** and navigate to the project directory:
   ```powershell
   cd D:\Stockpilot
   ```

2. **Create and Activate Python Virtual Environment:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   *(If script execution is disabled on your system, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

3. **Install Dependencies:**
   ```powershell
   python -m pip install --upgrade pip
   pip install -r backend\requirements-dev.txt
   ```

4. **Initialize Environment Variables:**
   ```powershell
   Copy-Item .env.example .env
   ```

5. **Run the Backend API Server:**
   ```powershell
   python backend\wsgi.py
   ```
   *The server starts at `http://localhost:5000`.*

6. **Verify Server Health:**
   Open a separate PowerShell window and execute:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:5000/api/health -Method GET
   ```
   *Expected JSON output:*
   ```json
   {
     "database": "connected",
     "status": "healthy",
     "timestamp": "2026-10-24T...",
     "version": "1.0.0"
   }
   ```

---

## 4. Running Automated Tests

### 4.1 Backend Health & Connectivity Tests
```powershell
# Run backend tests with verbose output
pytest tests\backend -v
```

### 4.2 Test Coverage Report
```powershell
pytest tests\backend --cov=backend\app --cov-report=term-missing
```

---


### 5. Inspect and Clean Unused Docker Storage
```powershell
# View Docker disk consumption
docker system df

# Prune stopped containers, dangling images, and build cache
docker system prune -a --volumes
```

---

## 6. Implementation Stages & Roadmap

| Stage | Focus Area | Status |
| :--- | :--- | :---: |
| **Stage 1** | Foundation setup, project structure, `/api/health`, tests, and docs | **Completed** |
| **Stage 2** | Database models (SQLAlchemy), Alembic migrations, RBAC & Auth API | Next Up |
| **Stage 3** | Pessimistic locking transaction engine (Anti-Overselling) & Movement Ledger | Upcoming |
| **Stage 4** | Frontend React SPA (Auth, Catalog, Cart, Order, Dashboard) | Upcoming |
| **Stage 5** | Docker Compose multi-container stack & named volume persistence proof | Upcoming |
| **Stage 6** | Automated Pytest concurrency & Selenium browser E2E testing | Upcoming |
| **Stage 7** | AWS High-Availability Cloud Deployment (ALB + ASG 2x EC2 + RDS) | Upcoming |
