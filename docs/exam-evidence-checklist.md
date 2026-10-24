# StockPilot - CSC418 DevOps Exam Evidence Checklist

**Course:** CSC418 DevOps for Cloud Computing  
**Project:** StockPilot Lab Exam Deliverables  
**Status:** In Progress (Planning Phase Complete)  
**Evidence Target Directory:** `evidence/`  

---

## 1. Exam Rubric Master Checklist

This checklist directly maps every grading requirement from the CSC418 syllabus to an exact verification command, expected outcome, and target screenshot artifact.

| # | Exam Requirement | Verification Command | Expected Output / Artifact | Status |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Custom Docker Image & Dockerfile** | `docker build -t stockpilot-api:latest -f backend/Dockerfile .`<br>`docker inspect stockpilot-api:latest` | Multi-stage build succeeds; custom labels and non-root user visible.<br>Artifact: `evidence/01_docker_build.png` | ⏳ Planned |
| **2** | **Docker Compose with Communicating Containers** | `docker compose up -d`<br>`docker compose ps`<br>`docker compose exec frontend ping backend` | Containers `frontend`, `backend`, and `postgres` healthy; inter-container DNS resolution verified.<br>Artifact: `evidence/02_docker_compose_up.png` | ⏳ Planned |
| **3** | **PostgreSQL Named Volume & Persistence Proof** | `docker compose down`<br>`docker compose up -d`<br>`docker compose exec postgres psql -U stockpilot_user -d stockpilot -c "SELECT count(*) FROM products;"` | Database row count matches pre-shutdown state; volume `stockpilot_pgdata` preserved.<br>Artifact: `evidence/03_named_volume_persistence.png` | ⏳ Planned |
| **4** | **Linux Administration & Container Permissions** | `docker compose exec backend id`<br>`docker compose exec backend ps aux` | Shows execution as non-root user `appuser` (`uid=10001`); process hierarchy inspection.<br>Artifact: `evidence/04_linux_permissions_and_processes.png` | ⏳ Planned |
| **5** | **ACID Transactions & Anti-Overselling Prevention** | `pytest tests/backend/test_concurrency.py -v` | Concurrent checkout test passes; rejects over-order with HTTP 409.<br>Artifact: `evidence/05_concurrency_anti_oversell.png` | ⏳ Planned |
| **6** | **Selenium WebDriver Browser E2E Tests** | `pytest tests/selenium/ -v --headless` | Full browser test suite passes across login, product creation, receipt, checkout, and alerts.<br>Artifact: `evidence/06_selenium_test_suite_passed.png` | ⏳ Planned |
| **7** | **Two EC2 Instances behind AWS ALB & ASG** | `aws elbv2 describe-target-health --target-group-arn <TG_ARN>`<br>`aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names stockpilot-asg` | 2 healthy EC2 instances listed in Target Group; ASG desired/min = 2.<br>Artifact: `evidence/07_aws_alb_asg_two_instances.png` | ⏳ Planned |
| **8** | **Application Accessible via ALB DNS** | `curl -I http://<ALB_DNS_NAME>/api/health`<br>Browser screenshot of ALB URL | HTTP 200 OK with `status: healthy` and load balancer headers.<br>Artifact: `evidence/08_alb_live_browser_access.png` | ⏳ Planned |
| **9** | **Shared Cloud Database Architecture (RDS)** | `aws rds describe-db-instances --db-instance-identifier stockpilot-db` | Active RDS PostgreSQL instance connected to both EC2 instances.<br>Artifact: `evidence/09_aws_rds_shared_database.png` | ⏳ Planned |
| **10**| **High Availability & Fault Recovery Demo** | `aws ec2 terminate-instances --instance-ids <INSTANCE_1_ID>` | ALB routes all traffic to remaining instance with zero downtime; ASG replaces terminated instance.<br>Artifact: `evidence/10_asg_fault_tolerance_recovery.png` | ⏳ Planned |

---

## 2. Detailed Execution Guide for Exam Evidence Capture

### Evidence Item 3: Step-by-Step PostgreSQL Named Volume Persistence Proof
To produce undeniable evidence for the course evaluator that data survives container recreation:
1. Ensure stack is running: `docker compose up -d`
2. Insert a dedicated persistent proof record via the StockPilot REST API:
   ```bash
   curl -X POST http://localhost:5000/api/products \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"sku":"EXAM-PERSIST-999","name":"Persistence Verification Product","unit_price":99.99,"cost_price":50.00,"initial_stock":100}'
   ```
3. Take terminal screenshot #1 showing record creation and initial `docker compose ps`.
4. Run container destruction:
   ```bash
   docker compose down
   ```
5. Confirm containers are removed: `docker ps -a` (shows 0 StockPilot containers).
6. Re-launch containers:
   ```bash
   docker compose up -d
   ```
7. Query PostgreSQL directly inside the newly spawned container:
   ```bash
   docker compose exec postgres psql -U stockpilot_user -d stockpilot -c "SELECT sku, name, current_stock, created_at FROM products WHERE sku='EXAM-PERSIST-999';"
   ```
8. Take screenshot #2 showing the exact returned row matching initial data. Save to `evidence/03_named_volume_persistence.png`.

---

### Evidence Item 4: Linux Permissions & Security Verification
To prove Linux system administration competencies inside container environments:
1. Inspect user UID/GID inside the backend container:
   ```bash
   docker compose exec backend whoami
   docker compose exec backend id
   ```
   *Expected:* `uid=10001(appuser) gid=10001(appuser)` (Confirms non-root execution).
2. Inspect filesystem permissions:
   ```bash
   docker compose exec backend ls -ld /app
   ```
   *Expected:* `drwxr-xr-x appuser appuser ... /app`.
3. Save terminal output screenshot to `evidence/04_linux_permissions_and_processes.png`.

---

### Evidence Item 8 & 10: AWS ALB Load Balancing & Fault Recovery
1. Open terminal on your host machine and run 10 continuous curl requests against the ALB DNS:
   ```bash
   for i in {1..10}; do curl -s http://<ALB-DNS-NAME>/api/health; echo ""; sleep 1; done
   ```
2. Note the responses being served seamlessly.
3. In AWS Console or CLI, forcefully terminate one EC2 instance (`aws ec2 terminate-instances --instance-ids i-xxxxxxx`).
4. Re-run the curl loop during termination: notice zero HTTP 5xx errors as ALB detects health state and shifts 100% of traffic to the healthy peer instance.
5. Within 2-3 minutes, capture the ASG spawning a replacement instance and bringing it into `Healthy` state in Target Group.
6. Save combined screenshot to `evidence/10_asg_fault_tolerance_recovery.png`.
