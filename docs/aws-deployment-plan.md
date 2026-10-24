# StockPilot - AWS Cloud Deployment Plan

**Course:** CSC418 DevOps for Cloud Computing  
**System:** StockPilot Cloud Infrastructure  
**Target Cloud:** Amazon Web Services (AWS)  
**Architecture:** 2x EC2 Instances behind Application Load Balancer (ALB) + Auto Scaling Group (ASG) with Shared Amazon RDS PostgreSQL  
**Version:** 1.0.0  

> [!IMPORTANT]
> **Zero Cost Policy & Explicit Approval:** No AWS resources will be created, modified, or provisioned without your explicit instruction. This deployment plan provides the complete blueprint, exact CLI/Console commands, cost projections, and teardown steps for when you are ready to deploy.

---

## 1. High Availability (HA) Cloud Architecture

The StockPilot AWS deployment strictly adheres to the CSC418 lab exam requirement for a scalable, load-balanced, multi-instance web application with a centralized shared database.

```
                                  INTERNET
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Internet Gateway (IGW)  │
                        └─────────────┬─────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │ AWS Application Load Balancer (ALB) │
                   │  - Dual-AZ (us-east-1a, us-east-1b) │
                   │  - Security Group: alb-sg (Port 80) │
                   └──────────────────┬──────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │ Target Group: stockpilot-alb-tg     │
                   │  - Protocol: HTTP Port 80           │
                   │  - Health Check: GET /api/health    │
                   │  - Interval: 15s | Timeout: 5s      │
                   └──────────────────┬──────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │ Auto Scaling Group (ASG)            │
                   │  - Desired: 2 | Min: 2 | Max: 3     │
                   │  - Health Check Type: ELB           │
                   ├──────────────────┬──────────────────┤
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │  EC2 Instance 1     │               │  EC2 Instance 2     │
        │  (us-east-1a)       │               │  (us-east-1b)       │
        │  - Type: t3.micro   │               │  - Type: t3.micro   │
        │  - Docker Engine    │               │  - Docker Engine    │
        │  - StockPilot App   │               │  - StockPilot App   │
        └──────────┬──────────┘               └──────────┬──────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │ Port 5432 (Internal SG)
                                      ▼
                   ┌─────────────────────────────────────┐
                   │ Amazon RDS PostgreSQL               │
                   │  - Instance: db.t4g.micro / t3.micro│
                   │  - Multi-AZ: Enabled (or Single-AZ) │
                   │  - Engine: PostgreSQL 16            │
                   │  - Security Group: rds-sg           │
                   └─────────────────────────────────────┘
```

---

## 2. Infrastructure Components & Security Specifications

### 2.1 Networking & VPC Layout
- **VPC CIDR:** `10.0.0.0/16`
- **Subnets:**
  - `subnet-public-1a` (`10.0.1.0/24`) in `us-east-1a` (ALB & EC2)
  - `subnet-public-1b` (`10.0.2.0/24`) in `us-east-1b` (ALB & EC2)
  - `subnet-db-1a` (`10.0.10.0/24`) in `us-east-1a` (RDS Subnet Group)
  - `subnet-db-1b` (`10.0.20.0/24`) in `us-east-1b` (RDS Subnet Group)
- **Internet Gateway (IGW):** Attached to VPC, route table `0.0.0.0/0 -> igw`.

### 2.2 Security Groups (Least Privilege)
1. **`alb-sg` (Application Load Balancer SG):**
   - Inbound: Port 80 (HTTP) from `0.0.0.0/0`.
   - Outbound: All traffic to target instances.
2. **`app-ec2-sg` (EC2 Instances SG):**
   - Inbound: Port 80 from `alb-sg` only (direct access from the internet to EC2 is blocked).
   - Inbound: Port 22 (SSH) from student's specific administrative IP (optional).
   - Outbound: All traffic (to pull Docker images and reach RDS).
3. **`rds-sg` (RDS Database SG):**
   - Inbound: Port 5432 (PostgreSQL) from `app-ec2-sg` only.
   - Outbound: Denied.

---

## 3. EC2 Launch Template & User Data Automation

Instances launched by the Auto Scaling Group execute an automated bootstrap script (`User Data`) on first boot to install Docker, pull the pre-built StockPilot images, and start the application:

```bash
#!/bin/bash
# StockPilot EC2 Automated Bootstrap Script
set -e

# Update and install Docker
yum update -y
yum install -y docker git
systemctl enable docker
systemctl start docker

# Install Docker Compose Plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Pull StockPilot Production Stack or clone repository
git clone https://github.com/dxb-dev/stockpilot.git /opt/stockpilot || true
cd /opt/stockpilot

# Configure environment pointing to centralized Amazon RDS
cat <<EOF > .env
DATABASE_URL=postgresql://stockpilot_admin:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/stockpilot
JWT_SECRET_KEY=${JWT_SECRET}
FLASK_ENV=production
EOF

# Launch application via Docker Compose
docker compose -f docker-compose.prod.yml up -d
```

---

## 4. Auto Scaling Group (ASG) & ALB Configuration

- **Target Group:** `stockpilot-tg`
  - Target Type: `instance`
  - Protocol: `HTTP`, Port: `80`
  - Health Check Path: `/api/health`
  - Healthy Threshold: 2 consecutive successes
  - Unhealthy Threshold: 3 consecutive failures
  - Health Check Interval: 15 seconds
- **Auto Scaling Group Settings:**
  - Minimum Capacity: `2` (Ensures high availability)
  - Desired Capacity: `2` (Satisfies exam requirement of two active EC2 instances)
  - Maximum Capacity: `3` (Allows scaling during load spike tests)
  - Target Group Attachment: `stockpilot-tg`
  - Availability Zones: `us-east-1a`, `us-east-1b`

---

## 5. Comprehensive AWS Cost Estimation

The following estimate is calculated for the US East (N. Virginia - `us-east-1`) region.

| Service / Resource | Specification | Quantity | Hourly Rate | Estimated Cost (24 Hours - Lab Exam) | Monthly Projected (If Left Running) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **EC2 Instances** | `t3.micro` (2 vCPU, 1 GiB RAM) | 2 | $0.0104 / hr | $0.50 | $15.18 |
| **EBS Storage** | General Purpose SSD (gp3) | 20 GB (2x 10 GB) | $0.08 / GB-mo | $0.05 | $1.60 |
| **Application Load Balancer** | ALB (1 LCU) | 1 | $0.0225 / hr | $0.54 | $16.20 |
| **Amazon RDS Database** | `db.t4g.micro` (Single-AZ) | 1 | $0.0160 / hr | $0.38 | $11.52 |
| **RDS Storage** | gp3 Storage | 20 GB | $0.115 / GB-mo | $0.08 | $2.30 |
| **Data Transfer** | Outbound to Internet (< 5 GB) | ~1 GB | $0.09 / GB | $0.09 | $0.09 |
| **TOTAL** | — | — | **~$0.065 / hr** | **~$1.64 for 1 Day** | **~$46.89 / month** |

> [!TIP]
> **Free Tier Eligibility:** If your AWS account is less than 12 months old, `t2.micro` or `t3.micro` EC2 instances (750 hours/mo) and `db.t3.micro` or `db.t4g.micro` RDS (750 hours/mo) are covered 100% under the AWS Free Tier. The only non-free component is the Application Load Balancer (~$0.0225/hr, costing approximately $0.50 for a full day exam run).

---

## 6. Complete Teardown Instructions (Zero Ongoing Cost)

To guarantee that you incur **zero unexpected costs** after capturing your lab exam evidence, execute the following teardown procedure immediately in reverse order:

### Step 1: Terminate Auto Scaling Group & EC2 Instances
```bash
# Set ASG desired and minimum to 0 to terminate EC2 instances
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name stockpilot-asg \
  --min-size 0 --desired-capacity 0 --max-size 0

# Delete the Auto Scaling Group
aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name stockpilot-asg --force-delete
```

### Step 2: Delete Application Load Balancer & Target Group
```bash
# Delete ALB
aws elbv2 delete-load-balancer \
  --load-balancer-arn <ALB_ARN>

# Delete Target Group
aws elbv2 delete-target-group \
  --target-group-arn <TARGET_GROUP_ARN>
```

### Step 3: Delete Amazon RDS Instance
```bash
# Delete RDS database without creating a final snapshot (for lab exam)
aws rds delete-db-instance \
  --db-instance-identifier stockpilot-db \
  --skip-final-snapshot \
  --delete-automated-backups
```

### Step 4: Delete Security Groups & Launch Template
```bash
aws ec2 delete-launch-template --launch-template-name stockpilot-lt
aws ec2 delete-security-group --group-id <APP_SG_ID>
aws ec2 delete-security-group --group-id <ALB_SG_ID>
aws ec2 delete-security-group --group-id <RDS_SG_ID>
```

### Step 5: Verification in AWS Console
Open the AWS Billing Dashboard and AWS Resource Groups to verify all active instances, load balancers, and database clusters report **0 active resources**.
