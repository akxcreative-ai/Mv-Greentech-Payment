# Production Deployment Guide

This guide details the procedures for deploying the **MV Payment Approval System** to a production cloud Virtual Private Server (VPS) or dedicated hardware with zero downtime, robust security hardening, automated backups, and SSL termination.

---

## Table of Contents

1. [VPS Sizing & Operating System](#1-vps-sizing--operating-system)
2. [Domain and DNS Configuration](#2-domain-and-dns-configuration)
3. [Server Hardening & Base Setup](#3-server-hardening--base-setup)
4. [Docker Production Deployment](#4-docker-production-deployment)
5. [SSL/TLS Setup with Let's Encrypt & Certbot](#5-ssltls-setup-with-lets-encrypt--certbot)
6. [Automated Database Backups & Disaster Recovery](#6-automated-database-backups--disaster-recovery)
7. [Monitoring, Logging & Observability](#7-monitoring-logging--observability)
8. [Maintenance, Rolling Updates & Rollback](#8-maintenance-rolling-updates--rollback)

---

## 1. VPS Sizing & Operating System

### Recommended Cloud Providers
- AWS (EC2), Google Cloud Platform (Compute Engine), DigitalOcean (Droplets), Hetzner Cloud, or Linode.
- **Operating System**: Ubuntu 24.04 LTS or Ubuntu 22.04 LTS (64-bit x86_64).

### Hardware Sizing Matrix

| Deployment Scale | Monthly Vouchers | vCPU | RAM | NVMe SSD Storage |
| :--- | :--- | :--- | :--- | :--- |
| **Small / Startup** | Up to 1,000 | 2 cores | 4 GB | 50 GB |
| **Medium / Regional** | 1,000 - 25,000 | 4 cores | 8 GB | 120 GB |
| **Enterprise** | 25,000+ | 8+ cores | 16+ GB | 250+ GB (RAID-1) |

---

## 2. Domain and DNS Configuration

Assign a dedicated Fully Qualified Domain Name (FQDN) to your instance (e.g., `payment.yourcompany.com`).

### DNS Records Table

| Record Type | Host | Points To | TTL | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `payment` | `203.0.113.10` | 300s (5m) | Public IPv4 address of the VPS |
| **AAAA** | `payment` | `2001:db8::10` | 300s (5m) | Public IPv6 address (if available) |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | 3600s | Authorizes Let's Encrypt for certs |

Allow DNS records to propagate before requesting SSL certificates:
```bash
# Verify DNS resolution on your workstation:
dig +short payment.yourcompany.com
nslookup payment.yourcompany.com
```

---

## 3. Server Hardening & Base Setup

Log in to the fresh server via SSH:

```bash
ssh root@your-server-ip
```

### 3.1. System Update & Package Installation
```bash
apt-get update && apt-get upgrade -y
apt-get install -y ufw curl wget git fail2ban ca-certificates gnupg lsb-release
```

### 3.2. Configure UFW (Uncomplicated Firewall)
Expose only SSH, HTTP, and HTTPS ports. All database and Redis ports will remain protected inside the Docker bridge network.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Let’s Encrypt'
ufw allow 443/tcp comment 'HTTPS Production'
ufw enable
```

### 3.3. Install Docker Engine & Docker Compose Plugin
```bash
# Add Docker official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker on system boot
systemctl enable docker
systemctl start docker
```

---

## 4. Docker Production Deployment

### 4.1. Clone Application Repository
```bash
mkdir -p /opt/mv-payment-approval
git clone https://github.com/your-org/mv-payment-approval.git /opt/mv-payment-approval
cd /opt/mv-payment-approval
```

### 4.2. Create Production Environment Configuration
```bash
cp .env.example .env
chmod 600 .env
```

Edit `/opt/mv-payment-approval/.env` with production secrets:
- Generate cryptographically secure keys:
  ```bash
  openssl rand -hex 32  # Use for SECRET_KEY
  openssl rand -hex 32  # Use for JWT_SECRET
  openssl rand -base64 24 # Use for POSTGRES_PASSWORD and REDIS_PASSWORD
  ```
- Set `APP_ENV=production` and `DEBUG=false`.
- Set `APP_URL=https://payment.yourcompany.com`.
- Set production SMTP credentials for transaction alerts.

### 4.3. Initialize Storage & Upload Directories
```bash
mkdir -p uploads/documents
chmod -R 775 uploads/
```

---

## 5. SSL/TLS Setup with Let's Encrypt & Certbot

The Nginx reverse proxy is configured to mount certbot challenge directories from `/var/www/certbot` and certificates from `/etc/nginx/ssl`.

### 5.1. Obtain Initial Certificates using Certbot
Install Certbot on the host machine:
```bash
apt-get install -y certbot
```

Run Certbot in standalone or webroot mode:
```bash
certbot certonly --webroot \
  -w /opt/mv-payment-approval/nginx/certbot/www \
  -d payment.yourcompany.com \
  --email security@yourcompany.com \
  --agree-tos \
  --no-eff-email
```

### 5.2. Link Certificates to Nginx Directory
```bash
mkdir -p /opt/mv-payment-approval/nginx/ssl
ln -sf /etc/letsencrypt/live/payment.yourcompany.com/fullchain.pem /opt/mv-payment-approval/nginx/ssl/fullchain.pem
ln -sf /etc/letsencrypt/live/payment.yourcompany.com/privkey.pem /opt/mv-payment-approval/nginx/ssl/privkey.pem
```

### 5.3. Automated Renewal via Systemd Timer
Test certificate renewal dry run:
```bash
certbot renew --dry-run
```

Create a post-renewal hook to reload Nginx automatically when certificates renew:
```bash
cat << 'EOF' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#!/bin/bash
docker exec mv-payment-gateway nginx -s reload
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 6. Automated Database Backups & Disaster Recovery

Ensure financial transaction ledgers are backed up regularly with retention and offsite synchronization.

### 6.1. Backup Automation Script
Create `/usr/local/bin/backup-mv-db.sh`:

```bash
cat << 'EOF' > /usr/local/bin/backup-mv-db.sh
#!/usr/bin/env bash
set -eo pipefail

BACKUP_DIR="/var/backups/mv-payment"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mv_payment_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

# Execute PostgreSQL dump from container
docker exec -t mv-payment-postgres pg_dump -U mv_admin mv_payment | gzip > "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

echo "[$(date)] Backup completed: ${BACKUP_FILE}"

# Delete local backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "mv_payment_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Optional: Sync to AWS S3 or Cloudflare R2
# aws s3 cp "${BACKUP_FILE}" s3://your-company-db-backups/mv-payment/
EOF

chmod +x /usr/local/bin/backup-mv-db.sh
```

### 6.2. Cron Job Scheduling
Run backups every night at 02:00 UTC:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mv-db.sh >> /var/log/mv-db-backup.log 2>&1") | crontab -
```

### 6.3. Database Disaster Recovery Restoration
In case of catastrophic failure or data corruption:
```bash
# 1. Stop backend services
docker compose stop backend

# 2. Restore database from compressed backup
gunzip < /var/backups/mv-payment/mv_payment_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i mv-payment-postgres psql -U mv_admin -d mv_payment

# 3. Restart services
docker compose start backend
```

---

## 7. Monitoring, Logging & Observability

### 7.1. Inspecting Container Logs
Monitor container logs in real time:
```bash
# Stream all logs
docker compose logs -f --tail=100

# Stream specific service logs
docker compose logs -f backend
docker compose logs -f nginx
```

### 7.2. Docker Log Rotation Policy
Prevent Docker container logs from consuming disk space by creating `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```
Reload Docker daemon to apply:
```bash
systemctl restart docker
```

### 7.3. Health Probe Endpoints
Configure external uptime monitors (Uptime Kuma, Better Stack, Datadog) to ping:
- `GET https://payment.yourcompany.com/healthz` (Edge Nginx gateway check)
- `GET https://payment.yourcompany.com/api/v1/health` (FastAPI backend + PostgreSQL + Redis check)

---

## 8. Maintenance, Rolling Updates & Rollback

### 8.1. Deploying Application Updates
When deploying new releases:

```bash
cd /opt/mv-payment-approval

# 1. Pull latest code
git pull origin main

# 2. Build updated images
docker compose build backend frontend

# 3. Apply database migrations
docker compose run --rm backend alembic upgrade head

# 4. Gracefully recreate containers with minimal disruption
docker compose up -d --no-deps backend frontend

# 5. Reload Nginx configuration if modified
docker compose exec nginx nginx -s reload
```

### 8.2. Rollback Procedure
If an issue occurs in production:
```bash
# Check out previous stable git commit
git checkout <previous-stable-tag-or-commit>

# Rebuild and restart containers
docker compose up -d --build
```
