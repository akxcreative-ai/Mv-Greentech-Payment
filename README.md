# MV Payment Approval System

<div align="center">

<img src="frontend/public/icons/icon-192.svg" alt="MV Payment Approval Monogram" width="110" height="110" />

### *Enterprise-Grade Payment Voucher & Multi-Tier Approval Workflow Management*

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-1e3a5f?style=for-the-badge)](#license)

</div>

---

## 1. Overview

The **MV Payment Approval System** is a mission-critical financial governance platform designed for corporations, institutions, and high-volume organizations requiring automated, multi-tier payment authorization workflows.

It enforces strict **Separation of Duties (SoD)**, anti-fraud controls, cryptographic audit trails, and multi-level management approvals before corporate funds are disbursed. Equipped with a modern **Progressive Web App (PWA)**, financial controllers and department heads can review, sign, or reject vouchers instantly from desktop or mobile devices with secure offline resilience.

---

## 2. Key Features

- **Multi-Tier Approval Hierarchies**: Dynamic rule engine routing payments based on amount thresholds, department budgets, and cost centers (e.g., Tier 1 < $5,000; Tier 2 < $25,000; Executive Tier 3 > $25,000).
- **Anti-Fraud & Separation of Duties**: Built-in governance preventing requesters from self-approving vouchers, and prohibiting approvers from executing disbursements.
- **Progressive Web App (PWA)**: Installable standalone app on desktop, iOS, and Android. Pre-caches shell assets with custom branded offline fallback while strictly safeguarding financial APIs against insecure offline execution.
- **Immutable Audit Ledger**: Append-only audit logs recording every timestamp, IP address, user identity, action diff, and cryptographic hash verification.
- **Secure Document Processing**: Upload invoices, receipts, and contracts with strict 10MB limits, UUID-based file isolation, and MIME byte signature verification.
- **Real-Time Notification Engine**: WebSocket-driven instant alerts and mobile push notifications for urgent payment approvals.
- **Enterprise Edge Gateway**: Nginx reverse proxy providing automated SSL termination, TLS 1.3 hardening, Content Security Policy (CSP), HSTS preloading, and multi-tier rate limiting.

---

## 3. Technology Stack

```
                        +---------------------------+
                        |  Client / Mobile Browser  |
                        +-------------+-------------+
                                      |
                                  HTTPS (443)
                                      v
                        +---------------------------+
                        |   Nginx Reverse Proxy     |
                        |   SSL Termination & Rate  |
                        +------+-------------+------+
                               |             |
                 Static Assets |             | /api/* & /ws/*
                               v             v
             +--------------------+       +----------------------+
             |   Frontend SPA     |       |   FastAPI Backend    |
             |   (React 18 / Vite)|       |   (Python 3.12 / 4w) |
             +--------------------+       +----------+-----------+
                                                     |
                                   +-----------------+-----------------+
                                   |                                   |
                                   v                                   v
                      +------------------------+          +------------------------+
                      |   PostgreSQL 16 DB     |          |      Redis 7 Cache     |
                      |   (Vouchers, Audit)    |          |  (Tokens, Rate Limits) |
                      +------------------------+          +------------------------+
```

### Backend
- **Language**: Python 3.12
- **Framework**: FastAPI (Asynchronous ASGI)
- **Database ORM**: SQLAlchemy 2.0 (Asyncpg driver)
- **Migrations**: Alembic
- **Caching & Broker**: Redis 7
- **Authentication**: JWT (HS256) + Passlib (bcrypt) + TOTP Multi-Factor Authentication

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State & Data**: TanStack React Query + Zustand
- **PWA**: Service Worker (`sw.js`), Web App Manifest (`manifest.json`), Offline Fallback (`offline.html`)

### Infrastructure & Edge
- **Reverse Proxy**: Nginx 1.25 Alpine with custom SSL & Rate Limiting
- **Containers**: Multi-stage Docker builds for backend and frontend
- **Orchestration**: Docker Compose v2

---

## 4. Repository Structure

```
mv-payment-approval/
├── docker-compose.yml              # 5-service container orchestration stack
├── .env.example                    # Root environment variables template
├── .gitignore                      # Git exclusion rules for Python, Node, & uploads
├── README.md                       # Main project documentation
│
├── backend/                        # FastAPI application
│   ├── Dockerfile                  # Multi-stage Python 3.12 image
│   ├── requirements.txt            # Python dependencies
│   ├── alembic/                    # Database migration scripts
│   └── app/                        # REST API routing, models, schemas, services
│
├── frontend/                       # React 18 PWA application
│   ├── Dockerfile                  # Multi-stage Node.js build & Nginx serve image
│   ├── nginx.conf                  # Single-Page Application Nginx routing
│   ├── package.json                # Dependencies and scripts
│   ├── vite.config.ts              # Vite bundler configuration
│   └── public/                     # PWA static shell assets
│       ├── manifest.json           # Web App Manifest
│       ├── sw.js                   # Service Worker with financial security rules
│       ├── offline.html            # Branded offline fallback screen
│       └── icons/                  # 192x192 & 512x512 SVG Monograms
│
├── nginx/                          # Gateway reverse proxy
│   ├── nginx.conf                  # SSL termination, security headers, rate limiting
│   ├── ssl/                        # Mounted SSL/TLS certificates
│   └── certbot/                    # Let's Encrypt renewal integration
│
├── docs/                           # Technical documentation manuals
│   ├── ADMIN.md                    # Administrator operating manual
│   ├── USER.md                     # User & role-based workflow guide (Accountant, Approver, All)
│   ├── API.md                      # REST API specification & OpenAPI reference
│   ├── SECURITY.md                 # Security architecture & compliance checklist
│   ├── INSTALL.md                  # Complete local & container installation manual
│   └── DEPLOY.md                   # Cloud VPS production deployment guide
│
└── uploads/                        # Document attachment volume storage
    └── documents/                  # Invoices, receipts, vendor contracts
```

---

## 5. Quick Start (Docker Compose)

The fastest way to run the entire production-grade stack is via Docker Compose:

### 1. Clone & Configure
```bash
git clone https://github.com/your-org/mv-payment-approval.git
cd mv-payment-approval

# Initialize environment configuration
cp .env.example .env
```

### 2. Launch Services
```bash
docker compose up -d --build
```

### 3. Apply Migrations & Create Superadmin
```bash
# Run database schema migrations
docker compose exec backend alembic upgrade head

# Create initial administrator
docker compose exec backend python -m app.cli create-admin \
  --email "admin@example.com" \
  --name "Super Administrator" \
  --password "AdminSecret2026!#"
```

### 4. Access Application
- **Frontend PWA**: [http://localhost](http://localhost) (or [https://localhost](https://localhost))
- **Interactive API Documentation**: [http://localhost/api/v1/docs](http://localhost/api/v1/docs)
- **Health Check Probe**: [http://localhost/healthz](http://localhost/healthz)

---

## 6. Documentation Hub

Detailed operating manuals and architecture documents are available in the [`docs/`](docs/) directory:

- [**docs/ADMIN.md**](docs/ADMIN.md) &mdash; Administrator guide: setup, companies, departments, users, roles, approval rules, vendors, settings, audit logs, reports, backups.
- [**docs/USER.md**](docs/USER.md) &mdash; User guide: Accountant (create/submit/track/respond/record), Approver (review/approve/reject/clarify), All (login, notifications, profile, PWA install Android+iOS).
- [**docs/API.md**](docs/API.md) &mdash; REST API specification: base URLs, JWT auth, all endpoints grouped by module with request/response examples, error codes.
- [**docs/SECURITY.md**](docs/SECURITY.md) &mdash; Enterprise security checklist: auth, RBAC, data protection, API security, file uploads, sessions, encryption, audit, network, deployment, incident response.
- [**docs/INSTALL.md**](docs/INSTALL.md) &mdash; Detailed step-by-step installation instructions for local development (Python venv, Node, PostgreSQL, Redis) and Docker alternatives.
- [**docs/DEPLOY.md**](docs/DEPLOY.md) &mdash; Production deployment manual covering VPS provisioning, Let's Encrypt SSL/TLS automation, database backup scripts, monitoring, and rolling updates.

---

## 7. Service Worker & Offline Policy

Financial transactions require an active, encrypted connection to ensure immediate validation against corporate treasury balances and non-repudiation.

The PWA Service Worker (`frontend/public/sw.js`) implements strict policy boundaries:
- **App Shell (Pre-cached)**: Core HTML, manifest, styling, icons, and offline page are cached for instant startup.
- **Financial APIs (NEVER CACHED)**: Endpoints matching `/api/v1/approvals`, `/api/v1/payments`, `/api/v1/transactions`, and `/api/v1/auth` strictly bypass local caches. If a network interruption occurs, the client receives a structured offline response (`HTTP 503`) instructing the user to reconnect.
- **Navigation Fallback**: Navigation attempts while offline seamlessly render [`offline.html`](frontend/public/offline.html) with real-time network reconnection polling.

---

## 8. License & Support

This project is proprietary and confidential. All rights reserved.

For technical assistance, security audits, or deployment support, contact the infrastructure team at `support@example.com`.
