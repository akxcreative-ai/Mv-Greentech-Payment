# MV Greentech - System Architecture Document

> **Confidential & Proprietary** — MV Greentech Global Pvt. Ltd.  
> **System:** Enterprise Payment Approval & Financial Authorization System  
> **Revision:** 2.1 (Production Release)  
> **Target Environment:** Multi-tenant Cloud (Vercel Edge + Render Core + Managed PostgreSQL)

---

## 1. Executive Overview

The **MV Greentech Payment Approval System** is a mission-critical, enterprise-grade financial workflow orchestration engine. It automates, authorizes, audits, and tracks the complete disbursement lifecycle for both external vendor invoices and internal employee expense reimbursements (such as sales operational expenses).

The platform enforces strict financial segregation of duties (**Maker-Checker-Disburser**) across four distinct corporate roles:
1. **Requester (Maker):** Sales representatives, department executives, and project managers who raise payment vouchers or reimbursement claims.
2. **Approver / Director (Checker):** Senior executive management with monetary approval limits who validate, reject, or request clarification.
3. **Accountant (Disburser):** Finance department officers who verify bank coordinates, execute banking transfers (NEFT/RTGS/IMPS/UPI), and log Unique Transaction Reference (UTR) records.
4. **Super Administrator (Controller):** System controllers managing corporate hierarchies, companies, departments, user credentials, access revocation, and compliance audit logs.

```
+-----------------------------------------------------------------------------------+
|                            MV GREENTECH CLOUD TOPOLOGY                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Modern Browsers / PWA Mobile / Desktop ]                                       |
|                         |                                                         |
|                         v HTTPS (TLS 1.3)                                         |
|  +-------------------------------------------------------------+                  |
|  |             Vercel Edge Global CDN (Frontend)               |                  |
|  | - React 18 + Vite SPA                                       |                  |
|  | - Tailwind CSS Design Engine                                |                  |
|  | - Service Worker (sw.js v2.0.2 - FinSec Safe Caching)       |                  |
|  | - Zustand State Store + React Query Cache                   |                  |
|  +-------------------------------------------------------------+                  |
|                         |                                                         |
|                         v REST APIs (JSON / CORS Protected)                       |
|  +-------------------------------------------------------------+                  |
|  |           Render Containerized Core (Backend)               |                  |
|  | - Python 3.11+ / FastAPI Async Runtime                      |                  |
|  | - JWT Bearer Token Security + Refresh Token Rotation        |                  |
|  | - Granular Role-Based Access Control (RBAC)                 |                  |
|  | - Rate Limiter (Sliding Window Memory Engine)               |                  |
|  | - SQLAlchemy 2.0 Async ORM + Pydantic v2 Validation         |                  |
|  +-------------------------------------------------------------+                  |
|                         |                                                         |
|                         v Asyncpg Connection Pool                                 |
|  +-------------------------------------------------------------+                  |
|  |             Managed PostgreSQL 16 (Database)                |                  |
|  | - ACID-Compliant Financial Ledger                           |                  |
|  | - Encrypted at Rest & In-Transit                            |                  |
|  | - Comprehensive Audit Logging & Revision Tracking           |                  |
|  +-------------------------------------------------------------+                  |
+-----------------------------------------------------------------------------------+
```

---

## 2. High-Level Component Architecture

### 2.1 Technology Stack Summary

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.3.1` | Declarative component UI engine |
| **Build Tooling** | Vite | `^5.4.21` | High-speed ESM bundling and HMR |
| **Type Safety** | TypeScript | `^5.5.3` | Strict type checking across UI and API client |
| **State Management** | Zustand | `^4.5.2` | Lightweight global session and authentication store |
| **Server State** | TanStack React Query | `^5.28.9` | Automated caching, background re-fetching, mutation sync |
| **Form Management** | React Hook Form + Zod | `^7.51.1` / `^3.22.4` | Schema-driven form validation and sanitization |
| **Styling & Theme** | Tailwind CSS + Lucide Icons | `^3.4.1` / `^0.359.0` | Custom corporate theme (`#0D5C3A`), Dark mode support |
| **PWA Engine** | Vite PWA Plugin + Custom SW | `v2.0.2` | Offline app-shell caching, installable mobile/desktop experience |
| **Backend Runtime** | Python | `>=3.11` | Asynchronous backend execution runtime |
| **API Framework** | FastAPI | `^0.110.0` | High-performance async ASGI REST API |
| **ORM / Data Access** | SQLAlchemy Async + Alembic | `^2.0.28` | Type-safe asynchronous SQL query construction & migrations |
| **Database Driver** | Asyncpg | `^0.29.0` | High-throughput asynchronous PostgreSQL driver |
| **Security & Auth** | PyJWT + Passlib (bcrypt) | `^2.8.0` / `^1.7.4` | Cryptographic JWT signing and salted password hashing |
| **Database** | PostgreSQL | `16+` | Relational, ACID-compliant multi-tenant persistence |

---

## 3. Financial Workflow Architecture

The system supports two core transaction paths:
1. **External Vendor Invoice Payment:** Funds disbursed directly to registered external suppliers/vendors.
2. **Internal Employee Expense Reimbursement:** Funds disbursed directly to employee bank/UPI details for travel, daily allowances, client meetings, or emergency purchases.

```
+-----------------------------------------------------------------------------------+
|                        FINANCIAL DISBURSEMENT PIPELINE                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ SALES / REQUESTER ]                                                            |
|         |                                                                         |
|         +---> Selects: Vendor Invoice OR Employee Reimbursement                   |
|         +---> Enters Amount, Due Date, Tax / GST, Attachments                     |
|         +---> Form Submission -> Validation -> POST /api/v1/payment-requests      |
|         |                                                                         |
|         v (Status: PENDING_APPROVAL)                                              |
|                                                                                   |
|  [ APPROVER / DIRECTOR ]                                                          |
|         |                                                                         |
|         +---> In-App & Email Notification Received                                |
|         +---> Inspects Supporting Documents & Invoices                            |
|         +---> Action:                                                             |
|                 |                                                                 |
|                 +-- [ CLARIFY ] -------> Status: CLARIFICATION_REQUESTED          |
|                 |                           ^ Requester answers -> Resubmits      |
|                 |                                                                 |
|                 +-- [ REJECT ] --------> Status: REJECTED                         |
|                 |                           (Audit Logged with Mandatory Reason)  |
|                 |                                                                 |
|                 +-- [ APPROVE ] -------> Status: APPROVED                         |
|                                             v                                     |
|  [ ACCOUNTANT / FINANCE ]                   |                                     |
|         |                                   |                                     |
|         +---> Queued in Payment Processing -+                                     |
|         +---> Verifies Payee Bank IFSC / UPI ID / Account Number                  |
|         +---> Executes Bank Transfer (NEFT / RTGS / IMPS / UPI)                   |
|         +---> Enters UTR / Transaction ID + Payment Date                          |
|         +---> POST /api/v1/payments                                               |
|         |                                                                         |
|         v (Status: PAID)                                                          |
|                                                                                   |
|  [ COMPLETE & AUDITED ]                                                           |
|         +---> Immutable Payment Voucher generated                                 |
|         +---> Requester notified of successful settlement                         |
|         +---> Ledger synchronized for monthly financial reporting                 |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 4. Database Schema & Data Models

The relational schema resides in PostgreSQL, accessed exclusively via asynchronous SQLAlchemy models:

```
  +------------------+         1:N         +--------------------+
  |    companies     |-------------------->|    departments     |
  +------------------+                     +--------------------+
           | 1:N                                     | 1:N
           v                                         v
  +------------------+         N:1         +--------------------+
  |      roles       |<--------------------|       users        |
  +------------------+                     +--------------------+
                                                     |
                                                     | 1:N (Requester)
                                                     v
  +------------------+         N:1         +--------------------+
  |     vendors      |<--------------------|  payment_requests  |
  +------------------+ (Optional for       +--------------------+
                        Reimbursement)         |          |
                                          1:N  |          | 1:1
                                               v          v
                                  +------------------+  +------------------+
                                  | approval_records |  | payment_records  |
                                  +------------------+  +------------------+
                                           |                     |
                                           v                     v
                                  +----------------------------------------+
                                  |               audit_logs               |
                                  +----------------------------------------+
```

### 4.1 Key Table Schemas

#### `companies`
- `id` (UUID, Primary Key)
- `name` (String, e.g. "MV Greentech")
- `code` (String Unique, e.g. "MVG-01")
- `gst_number`, `pan_number` (String)
- `primary_color` (String, default: `#0D5C3A`)
- `is_active` (Boolean)

#### `departments`
- `id` (UUID, Primary Key)
- `company_id` (UUID, FK -> `companies.id`)
- `name` (String, e.g. "Accounts & Finance", "Operations")
- `code` (String, e.g. "FIN-01", "OPS-01")
- `is_active` (Boolean)

#### `users`
- `id` (UUID, Primary Key)
- `company_id` (UUID, FK -> `companies.id`)
- `department_id` (UUID, FK -> `departments.id`)
- `role_id` (UUID, FK -> `roles.id`)
- `email` (String Unique)
- `password_hash` (String, Bcrypt 12 rounds)
- `first_name`, `last_name` (String)
- `phone` (String)
- `approval_limit` (Numeric, e.g. 10000000.00)
- `is_active`, `is_locked` (Boolean)

#### `payment_requests`
- `id` (UUID, Primary Key)
- `voucher_number` (String Unique, e.g. `PAY-2026-0001`)
- `company_id`, `department_id`, `requester_id` (FKs)
- `recipient_type` (Enum: `VENDOR` | `EMPLOYEE_REIMBURSEMENT`)
- `vendor_id` (UUID, FK -> `vendors.id`, Nullable for reimbursements)
- `payee_name`, `payee_account_number`, `payee_ifsc`, `payee_upi_id` (String)
- `amount` (Numeric, 12,2)
- `category` (Enum: Raw Materials, Travel, Operational, Utility, etc.)
- `status` (Enum: `DRAFT`, `PENDING_APPROVAL`, `CLARIFICATION_REQUESTED`, `APPROVED`, `REJECTED`, `PROCESSING`, `PAID`, `CANCELLED`)
- `invoice_number`, `invoice_date`, `due_date` (DateTime)
- `created_at`, `updated_at` (DateTime)

#### `approval_records`
- `id` (UUID, Primary Key)
- `payment_request_id` (UUID, FK -> `payment_requests.id`)
- `approver_id` (UUID, FK -> `users.id`)
- `action` (Enum: `APPROVED`, `REJECTED`, `CLARIFICATION_REQUESTED`)
- `comments` (Text)
- `created_at` (DateTime)

#### `payment_records`
- `id` (UUID, Primary Key)
- `payment_request_id` (UUID Unique, FK -> `payment_requests.id`)
- `accountant_id` (UUID, FK -> `users.id`)
- `payment_method` (Enum: `NEFT`, `RTGS`, `IMPS`, `UPI`, `CHEQUE`)
- `utr_number` (String Unique)
- `paid_amount` (Numeric)
- `payment_date` (DateTime)
- `notes` (Text)

#### `audit_logs`
- `id` (UUID, Primary Key)
- `user_id` (UUID Nullable, FK -> `users.id`)
- `event_type` (Enum: `LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `APPROVE`, `REJECT`, `DISBURSE`, `DELETE`)
- `entity_type` (String, e.g. `payment_request`, `user`)
- `entity_id` (UUID)
- `old_value`, `new_value` (JSONB)
- `ip_address`, `user_agent` (String)
- `created_at` (DateTime)

---

## 5. Security & Authentication Architecture

1. **Authentication Token Lifecycle:**
   - **Access Token:** Short-lived JWT (30 minutes expiry) stored in frontend memory/Zustand store. Attached as `Authorization: Bearer <token>` in Axios interceptor.
   - **Refresh Token:** Cryptographically signed long-lived token (7 days expiry) stored securely in `httpOnly`, `Secure`, `SameSite=Strict` cookie or encrypted storage. Automatic silent refresh triggers on 401 response via Axios interceptors.
2. **Password Cryptography:**
   - Salted `bcrypt` hashing with work factor of 12 rounds. Plaintext passwords never touch database or persistent logs.
3. **Role-Based Access Control (RBAC):**
   - Protected routes in React are guarded by `<RoleGuard allowedRoles={[...]} />`.
   - FastAPI endpoints enforce dependency injection checks via `Depends(require_permission(...))` and `Depends(get_current_active_user)`.
4. **Brute-Force & Rate Limiting:**
   - Login rate-limiter triggers sliding window cooldowns after consecutive failed authentication attempts.
   - Automatic lockout alert after 5 consecutive failed login attempts.
5. **Data Isolation & Normalization:**
   - Zero mock data fallback in production builds. All data streams from live database via normalized list responses (`{ items: [], total: 0 }`).

---

## 6. Deployment & Infrastructure Pipeline

```
[ Developer Local ]
       |
       v git push origin main
[ GitHub Repository (akxcreative-ai/Mv-Greentech-Payment) ]
       |
       +-----------------------------------+
       |                                   |
       v Webhook                           v Webhook
[ Vercel Edge Global ]            [ Render Cloud Core ]
- Trigger: Push to main           - Trigger: Push to main
- Build: `npm run build`          - Build: `pip install -r requirements.txt`
- Output: `dist/`                 - Start: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
- Domain:                         - Domain:
  frontend-inky-sigma-84.vercel.app  mv-greentech-payment.onrender.com
```

### Production Health Checks
- **Frontend Health:** Root `/` returns HTTP 200 with bundled Vite PWA assets.
- **Backend Health:** `GET /health` returns `{"status": "healthy", "database": "connected"}`.
- **Setup Verification:** `GET /api/setup/status` returns `{"initialized": true, "total_users": 4}`.
