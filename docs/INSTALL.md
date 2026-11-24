# Installation and Setup Guide

This guide provides step-by-step instructions for installing, configuring, and running the **MV Payment Approval System** in both local development environments and containerized Docker setups.

---

## Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
2. [Repository Setup](#2-repository-setup)
3. [Backend Setup (FastAPI & Python 3.12)](#3-backend-setup-fastapi--python-312)
4. [Frontend Setup (React, Vite & Node.js 20)](#4-frontend-setup-react-vite--nodejs-20)
5. [Docker Setup Alternative (Recommended)](#5-docker-setup-alternative-recommended)
6. [Initial Superadmin Account Creation](#6-initial-superadmin-account-creation)
7. [Verifying the Installation](#7-verifying-the-installation)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. System Prerequisites

Ensure your host machine meets the following minimum version requirements:

| Component | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.12.0+` | Backend REST API server |
| **Node.js** | `20.10.0+` (LTS) | Frontend web build tooling |
| **npm** | `10.0.0+` | Frontend package management |
| **PostgreSQL** | `16.0+` | Primary relational database |
| **Redis** | `7.0+` | In-memory session store & cache |
| **Docker & Docker Compose** | `24.0+` / `v2.20+` | Optional: Containerized orchestration |
| **Git** | `2.40+` | Version control |

### Verifying Prerequisites Locally

```bash
# Verify Python
python3 --version  # or 'python --version' on Windows

# Verify Node.js and npm
node --version
npm --version

# Verify PostgreSQL client
psql --version

# Verify Redis client
redis-cli --version

# Verify Docker (if using Docker)
docker --version
docker compose version
```

---

## 2. Repository Setup

Clone the repository and inspect the folder hierarchy:

```bash
git clone https://github.com/your-org/mv-payment-approval.git
cd mv-payment-approval
```

### Directory Structure Overview

```
mv-payment-approval/
├── docker-compose.yml          # Container stack orchestration
├── .env.example                # Canonical environment variables template
├── backend/                    # FastAPI REST API application
│   ├── Dockerfile              # Multi-stage Python 3.12 container
│   ├── requirements.txt        # Backend dependencies
│   ├── alembic/                # Database migrations
│   └── app/                    # Application source code
├── frontend/                   # React 18 + Vite PWA frontend
│   ├── Dockerfile              # Multi-stage Node + Nginx container
│   ├── package.json            # Node dependencies and scripts
│   ├── nginx.conf              # SPA routing server configuration
│   └── public/                 # Static assets, PWA manifest, service worker
├── nginx/                      # Edge reverse proxy & SSL termination
│   └── nginx.conf              # Production gateway configuration
├── docs/                       # Architectural and operations documentation
│   ├── INSTALL.md              # This setup guide
│   ├── DEPLOY.md               # Production deployment manual
│   └── SECURITY.md             # Security and compliance checklist
└── uploads/                    # File upload storage (invoices, receipts)
```

---

## 3. Backend Setup (FastAPI & Python 3.12)

### 3.1. Create and Activate Virtual Environment

**On Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

**On Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3.2. Install Python Dependencies

```bash
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 3.3. Database Provisioning (PostgreSQL)

Launch `psql` as a superuser to provision the database and application user:

```sql
-- Connect to local PostgreSQL
-- psql -U postgres

CREATE USER mv_admin WITH PASSWORD 'secure_postgres_password';
CREATE DATABASE mv_payment OWNER mv_admin;
GRANT ALL PRIVILEGES ON DATABASE mv_payment TO mv_admin;

-- Grant schema privileges (PostgreSQL 15+)
\c mv_payment
GRANT ALL ON SCHEMA public TO mv_admin;
```

### 3.4. Configure Environment Variables

Create the backend environment file:

```bash
# From the project root:
cp .env.example backend/.env
```

Edit `backend/.env` to point to your local PostgreSQL and Redis:
```ini
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mv_payment
POSTGRES_USER=mv_admin
POSTGRES_PASSWORD=secure_postgres_password
DATABASE_URL=postgresql+asyncpg://mv_admin:secure_postgres_password@localhost:5432/mv_payment

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_URL=redis://:secure_redis_password@localhost:6379/0
```

### 3.5. Run Database Migrations

Apply Alembic database migrations to create all tables (users, roles, payment requests, approvals, audit logs):

```bash
cd backend
alembic upgrade head
```

### 3.6. Start Backend Development Server

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The interactive OpenAPI Swagger documentation will be accessible at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

---

## 4. Frontend Setup (React, Vite & Node.js 20)

### 4.1. Install NPM Dependencies

Open a new terminal tab and navigate to `frontend`:

```bash
cd frontend
npm install
```

### 4.2. Configure Frontend Environment

Create a `.env` file in the `frontend` folder:

```bash
cp ../.env.example frontend/.env
```

Ensure the API proxy points to your local backend server:
```ini
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_TITLE="MV Payment Approval"
VITE_ENABLE_PWA=true
```

### 4.3. Start the Frontend Development Server

```bash
npm run dev
```

The Vite development server will start at:
- **Web Application**: [http://localhost:3000](http://localhost:3000)

---

## 5. Docker Setup Alternative (Recommended)

Docker Compose provides a zero-dependency, automated deployment of all 5 services: `postgres`, `redis`, `backend`, `frontend`, and `nginx`.

### 5.1. Initialize Root Environment Configuration

From the project root:

```bash
cp .env.example .env
```

Review `.env` and set passwords.

### 5.2. Build and Launch Containers

```bash
docker compose up -d --build
```

Docker Compose will build the multi-stage images, wait for PostgreSQL and Redis health checks, and start the gateway.

### 5.3. Check Container Health Status

```bash
docker compose ps
```

All services (`mv-payment-postgres`, `mv-payment-redis`, `mv-payment-backend`, `mv-payment-frontend`, `mv-payment-gateway`) should report status `Up (healthy)`.

### 5.4. Apply Migrations Inside Container

```bash
docker compose exec backend alembic upgrade head
```

---

## 6. Initial Superadmin Account Creation

To access the administrative dashboard, create the initial superadmin user:

### Using the Python CLI (Local Development)

```bash
cd backend
python -m app.cli create-admin \
  --email "admin@example.com" \
  --name "Super Administrator" \
  --password "AdminSecret2026!#"
```

### Using Docker Compose

```bash
docker compose exec backend python -m app.cli create-admin \
  --email "admin@example.com" \
  --name "Super Administrator" \
  --password "AdminSecret2026!#"
```

---

## 7. Verifying the Installation

Test all critical interfaces:

1. **Frontend Web Interface**: Visit `http://localhost` (Docker) or `http://localhost:3000` (Local dev).
2. **Login Test**: Enter the superadmin credentials created in Step 6.
3. **PWA Offline Test**:
   - Open Developer Tools (F12) &rarr; **Application** &rarr; **Service Workers**.
   - Verify `sw.js` is active and running.
   - Check the **Offline** checkbox in DevTools Network tab.
   - Navigate to `/approvals`. The custom branded offline fallback page (`offline.html`) should render with financial security notifications.
4. **API Health Check**:
   ```bash
   curl -i http://localhost/api/v1/health
   # Expected HTTP/1.1 200 OK with JSON {"status": "ok", "database": "connected", "redis": "connected"}
   ```

---

## 8. Troubleshooting & FAQ

### Port Conflicts (80, 443, 5432, 6379)
If default ports are occupied by existing services, adjust the host port mapping in `.env`:
```ini
HTTP_PORT=8080
HTTPS_PORT=8443
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### PostgreSQL Connection Refused
- Check that the PostgreSQL service is actively running:
  ```bash
  docker compose logs postgres
  ```
- Ensure `DATABASE_URL` uses the service name `postgres` inside Docker, or `localhost` outside Docker.

### Redis Authentication Failed
- Ensure `REDIS_PASSWORD` in `.env` matches the `--requirepass` argument in `docker-compose.yml` and the connection URL `redis://:<password>@<host>:6379/0`.

### File Upload Permission Issues
Ensure the `uploads/` directory on the host machine has appropriate write permissions:
```bash
chmod -R 775 uploads/
```
