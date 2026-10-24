# Docker Supporting Configurations

This directory contains container configurations and documentation for the StockPilot infrastructure:

- `Dockerfile.backend`: Stored in `backend/Dockerfile` (multi-stage, non-root user `appuser`).
- `docker-compose.yml`: Root multi-container definition connecting `frontend`, `backend`, and `postgres` on the private bridge network `stockpilot-net` with named volume `stockpilot_pgdata` (to be finalized and verified in Stage 5).
- `docker-compose.prod.yml`: Production configuration targeting Amazon RDS PostgreSQL.
