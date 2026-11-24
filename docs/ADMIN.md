# MV Payment Approval System — Administrator Guide

```
Document Version : 1.0.0
Release Date     : November 2026
Target Audience  : System Administrators, IT Operations, Financial Controllers
System Name      : MV Payment Approval System
Classification   : Confidential — Internal Enterprise Documentation
```

---

## 1. System Overview & Architecture

The **MV Payment Approval System** is an enterprise financial governance platform engineered to manage multi-entity, tiered payment voucher lifecycles with strict anti-fraud safeguards, Separation of Duties (SoD), and immutable audit logging.

```
                           +-------------------------------------+
                           |      System Administrator UI        |
                           |   (React 18 PWA / Admin Portal)     |
                           +------------------+------------------+
                                              |
                                     HTTPS (TLS 1.3 / Port 443)
                                              v
                           +-------------------------------------+
                           |      Nginx Edge Reverse Proxy       |
                           |    SSL Term, Rate Limit, WAF CSP    |
                           +------------------+------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |        FastAPI Core Backend         |
                           |  (Python 3.12 / REST API / SlowAPI) |
                           +---------+-----------------+---------+
                                     |                 |
                   SQLAlchemy 2.0 /  |                 | Redis Cache /
                   Asyncpg           v                 v Rate Limits
                         +-----------------+     +-----------------+
                         |  PostgreSQL 16  |     |     Redis 7     |
                         |  Relational DB  |     |   Session Cache |
                         +-----------------+     +-----------------+
                                     |
                                     v
                         +-------------------------+
                         | Local / S3 File Storage |
                         | (Encrypted Attachments) |
                         +-------------------------+
```

### Core Administrative Capabilities
- **Multi-Tenant / Multi-Company Structure**: Manage distinct corporate legal entities and their respective departmental hierarchies within a single platform.
- **Dynamic Tiered Approval Matrix**: Set minimum and maximum expenditure thresholds per company with specific role authorization requirements.
- **Role-Based Access Control (RBAC)**: Manage users, role assignments, department mappings, and account lifecycles.
- **Vendor Registry Governance**: Oversee vendor profiles, tax registrations (GSTIN/PAN), and banking disbursement coordinates.
- **Immutable Audit Ledger**: Access unalterable system audit logs with cryptographic chaining and JSON state diffs.
- **Disaster Recovery & Operational Maintenance**: Execute backup routines, configure SMTP gateways, and manage system parameters.

---

## 2. Initial Setup and First Login

Before general users access the platform, the system requires an initial administrative bootstrap to create built-in roles and configure the primary Super Administrator account.

### 2.1 Bootstrapping Methods

You can initialize the system using either the **Web Setup Wizard** or the **CLI Administrative Tool**.

#### Method 1: Web Setup Wizard (First Browser Launch)
1. Navigate to `https://<your-domain>/setup` or `http://localhost:3000/setup`.
2. The system checks if any existing users are registered:
   - If no users exist, the **Initial System Setup** screen is displayed.
   - If users already exist, this screen is permanently disabled with an `HTTP 403 Forbidden` response.
3. Fill in the required fields:
   - **First Name**: e.g., `Enterprise`
   - **Last Name**: e.g., `Administrator`
   - **Admin Email**: e.g., `admin@yourcompany.com`
   - **Administrative Password**: Minimum 8 characters (requires uppercase, lowercase, number, and special character).
4. Click **Complete Initial Setup**.
5. The backend automatically:
   - Initializes core system roles (`super_admin`, `director`, `accountant`, `department_head`).
   - Hashes credentials using `bcrypt`.
   - Records the `SYSTEM_EVENT` in the audit log.
   - Redirects to `/login`.

> [!CAUTION]
> Once the first administrator is created, the `/api/setup/init` endpoint is permanently blocked at the database level. Any subsequent requests will be rejected.

#### Method 2: Command-Line Interface (Docker / Headless Server)
If deploying via cloud automation scripts or Docker Compose, initialize the administrator via the CLI:

```bash
# Executing inside the backend container
docker compose exec backend python -m app.cli create-admin \
  --email "admin@yourcompany.com" \
  --first-name "Super" \
  --last-name "Admin" \
  --password "SecureAdminPass2026!#"
```

Expected output:
```text
[INFO] Bootstrapping MV Payment Approval System...
[INFO] Core roles verified: super_admin, director, accountant, department_head.
[INFO] Super administrator 'admin@yourcompany.com' successfully created with ID: 4f18b41e-3c2d-4d7a-8f4b-0e123456789a.
[INFO] Audit log recorded: EVENT=USER_CREATED, ENTITY=system.
```

### 2.2 First Login Procedure
1. Navigate to `/login`.
2. Input the administrator email and password created during bootstrapping.
3. Upon first authentication:
   - You will receive a short-lived access JWT token (30-minute validity) and a refresh token (7-day validity).
   - If configured in security settings, you will be prompted to enroll in Multi-Factor Authentication (TOTP).
4. Navigate to **Admin Dashboard** (`/admin`) from the top navigation bar.

---

## 3. Creating Companies and Departments

The MV Payment Approval System supports multi-entity corporate structures where payments are partitioned by company legal entities and departmental cost centers.

### 3.1 Managing Companies

Each operating company holds distinct bank accounts, tax identifiers, and approval rule thresholds.

#### Company Data Schema

| Field | Type | Description | Mandatory | Example |
| :--- | :--- | :--- | :---: | :--- |
| `name` | String(150) | Full legal business name | Yes | `MV Agro Industries Limited` |
| `code` | String(50) | Unique short corporate code | Yes | `MV-AGRO` |
| `gst_number` | String(15) | GST Identification Number | No | `27AABCM8891J1ZP` |
| `pan_number` | String(10) | Corporate Permanent Account Number | No | `AABCM8891J` |
| `address` | Text | Registered corporate head office address | No | `Plot 42, MIDC, Pune 411018` |
| `is_active` | Boolean | Operational status of the company | Yes | `true` |

#### Creating a Company (Step-by-Step)
1. In the Admin sidebar, navigate to **Organizations** > **Companies** (`/admin/companies`).
2. Click **+ Add Company** in the top-right toolbar.
3. In the modal dialog:
   - Enter **Company Name**: e.g., `MV Logistics & Supply Chain Pvt Ltd`
   - Enter **Company Code**: e.g., `MV-LOG` (must be uppercase, alphanumeric, unique)
   - Enter **GSTIN** and **PAN** for taxation matching.
   - Enter **Registered Address**.
   - Check **Active Status**.
4. Click **Save Company**.
5. The new company is immediately available in payment creation dropdowns and approval matrix settings.

> [!NOTE]
> Deactivating a company (`is_active = false`) soft-disables the entity. Existing vouchers and audit records remain intact, but users cannot submit new payment requests under that company.

---

### 3.2 Managing Departments

Departments represent cost centers within companies (e.g., Procurement, Information Technology, Human Resources, Plant Operations).

#### Department Data Schema

| Field | Type | Description | Mandatory | Example |
| :--- | :--- | :--- | :---: | :--- |
| `name` | String(100) | Department designation | Yes | `Information Technology` |
| `code` | String(50) | Departmental short code | Yes | `DEPT-IT` |
| `company_id` | UUID | Associated operating company | Yes | `c_01 (MV Agro)` |
| `head_id` | UUID | User assigned as Department Head | No | `User: Rahul Sharma` |
| `budget` | Numeric(15,2)| Annual / Operational budget ceiling | No | `5000000.00` |
| `is_active` | Boolean | Operational state of department | Yes | `true` |

#### Creating a Department (Step-by-Step)
1. In the Admin sidebar, navigate to **Organizations** > **Departments** (`/admin/departments`).
2. Click **+ Add Department**.
3. Fill out the form:
   - Select the parent **Company**.
   - Input **Department Name** (e.g., `Procurement & Raw Materials`).
   - Input **Department Code** (e.g., `DEPT-PROC`).
   - (Optional) Assign a **Department Head** from existing users.
   - (Optional) Input the allocated **Annual Budget**.
4. Click **Create Department**.

---

## 4. Managing Users and Roles

Access control is governed by an enterprise **Role-Based Access Control (RBAC)** architecture that prevents unauthorized access and enforces financial governance.

### 4.1 System Roles Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                      ROLE PERMISSIONS MATRIX                                       |
+----------------------+-----------------+---------------+-------------------+-----------------------+
| Capability           | Super Admin     | Director      | Accountant        | Department Head       |
+----------------------+-----------------+---------------+-------------------+-----------------------+
| System Settings      | Full Access     | Read-Only     | No Access         | No Access             |
| User Management      | Full Access     | Read-Only     | No Access         | No Access             |
| Company / Dept Admin | Full Access     | Read-Only     | No Access         | No Access             |
| Approval Matrix Rules| Full Access     | Read-Only     | No Access         | No Access             |
| Audit Logs           | Full Access     | Read-Only     | No Access         | No Access             |
| Create Payment Req   | Yes             | No            | Yes               | Yes                   |
| Approve Requests     | Override Only   | All Companies | No (SoD Guard)    | Departmental Limits   |
| Reject Requests      | Yes             | Yes           | No                | Yes                   |
| Request Clarification| Yes             | Yes           | No                | Yes                   |
| Execute Disbursement | No (SoD Guard)  | No (SoD Guard)| Full Access       | No                    |
| Vendor Management    | Full Access     | Read-Only     | Bank Details Edit | Read-Only             |
| Financial Reports    | Full Analytics  | Full Analytics| Disbursement Rep  | Departmental Only     |
+----------------------+-----------------+---------------+-------------------+-----------------------+
```

### 4.2 Anti-Fraud Separation of Duties (SoD) Rules
The system enforces strict operational barriers to prevent financial misappropriation:
1. **Self-Approval Prohibition**: A user who creates a payment request cannot approve it under any circumstance, regardless of assigned role.
2. **Approval-Disbursement Segregation**: Users with approval privileges (`director`, `department_head`) cannot record payment transactions or mark vouchers as disbursed.
3. **Disbursement-Approval Segregation**: Users who execute payouts (`accountant`) cannot approve vouchers.

---

### 4.3 Creating and Managing Users

#### Step-by-Step User Provisioning:
1. Navigate to **Administration** > **User Management** (`/admin/users`).
2. Click **+ Create User**.
3. Complete the user profile:
   - **Email Address**: Corporate email address (e.g., `priya.nair@yourcompany.com`).
   - **First Name** and **Last Name**.
   - **Temporary Password**: Minimum 8 characters.
   - **System Role**: Select `Super Administrator`, `Director`, `Accountant`, or `Department Head`.
   - **Company Assignment**: Primary legal entity.
   - **Department Assignment**: Primary cost center.
   - **Contact Phone**: Mobile number for notifications.
4. Check **Active Account** and click **Submit**.
5. The user will receive an automated onboarding email containing their temporary credentials.

#### Account Lockout & Password Resets
If a user inputs 5 consecutive incorrect passwords:
- The system automatically locks the account (`is_locked = true`) for **15 minutes**.
- An audit event `USER_LOCKED` is generated with client IP details.
- To immediately unlock the user, navigate to **User Management**, locate the user, click the action menu (`...`), and select **Unlock Account**.
- To reset a forgotten password on behalf of a user, select **Trigger Password Reset** to issue a signed 15-minute reset token to their email.

---

## 5. Configuring Approval Rules and Thresholds

The **Approval Rule Engine** governs how payment requests are routed to approvers based on voucher amount, corporate legal entity, and risk level.

```
+-----------------------------------------------------------------------------------+
|                            TIERED APPROVAL THRESHOLDS                             |
+-----------------------------------------------------------------------------------+
| Tier 1: Low-Value Vouchers (e.g., ₹0 — ₹2,00,000)                                |
|   -> Route to: Department Head                                                    |
|                                                                                   |
| Tier 2: Mid-Value Vouchers (e.g., ₹2,00,001 — ₹10,00,000)                         |
|   -> Route to: Finance Manager / Senior Management                                |
|                                                                                   |
| Tier 3: High-Value & Executive Vouchers (e.g., > ₹10,00,000)                      |
|   -> Route to: Director / Executive Board                                         |
+-----------------------------------------------------------------------------------+
```

### 5.1 Approval Rule Attributes

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `company_id` | UUID | Company to which this threshold tier applies. |
| `min_amount` | Decimal | Lower monetary limit (inclusive). Default: `0.00`. |
| `max_amount` | Decimal | Upper monetary limit (inclusive). Set to `NULL` for unbounded infinity. |
| `approver_role` | String | Role authorized to approve this tier (`department_head`, `director`). |
| `requires_approval` | Boolean | True if explicit approval is required before disbursement. |
| `is_active` | Boolean | Active state of the rule. |

### 5.2 Configuring a New Approval Tier

1. Navigate to **Administration** > **Settings** > **Approval Matrix Rules** (`/admin/settings`).
2. Click **+ Add Approval Rule**.
3. Select the target **Company** (e.g., `MV Holdings Private Limited`).
4. Define the monetary range:
   - **Min Amount**: `200001.00`
   - **Max Amount**: `1000000.00` (Leave blank if creating the highest unbounded tier).
5. Select the **Required Approver Role**:
   - For mid-level vouchers, assign `department_head` or executive roles.
   - For high-level vouchers (> ₹10,00,000), assign `director`.
6. Ensure **Requires Approval** is checked.
7. Click **Save Rule**.

> [!WARNING]
> Ensure threshold rules do not have monetary gaps. If a payment request is submitted for an amount that does not match any active rule, the system defaults to routing to the **Super Administrator** or **Director** as a safety fallback.

---

## 6. Managing Vendors

The Vendor Registry contains all approved suppliers, contractors, service providers, and payees.

### 6.1 Vendor Profile Fields

- **Vendor Name**: Registered legal trade name.
- **Vendor Code**: Unique internal supplier code (e.g., `VND-TATA-01`).
- **Category**: Primary goods or services supplied (Raw Materials, IT Software, Logistics, Utilities).
- **Tax Identifiers**: GSTIN (15 characters) and PAN (10 characters).
- **Contact Details**: Primary contact person, official email address, phone number.
- **Bank Disbursement Coordinates**:
  - Bank Name (e.g., `State Bank of India`)
  - Branch Name & Address
  - Bank Account Number
  - IFSC Code (11 alphanumeric characters) / SWIFT Code
  - Account Type (Current, Cash Credit, Savings)

### 6.2 Adding and Verifying a Vendor

1. In the sidebar, select **Master Data** > **Vendors** (`/admin/vendors`).
2. Click **+ Register Vendor**.
3. Enter General Information (Name, Code, Contact Email, GSTIN, PAN).
4. Enter Bank Account Information:
   - Carefully verify the account number and IFSC code against a cancelled cheque or bank statement.
5. Click **Save Vendor**.

> [!IMPORTANT]
> To prevent invoice redirection fraud, any modification to a vendor's bank account coordinates automatically triggers an audit log entry (`VENDOR_UPDATED`) and notifies administrators. Existing pending vouchers under that vendor display a warning banner indicating recent bank detail changes.

---

## 7. System Settings

The System Settings module (`/admin/settings`) configures global behaviors across the platform.

```
+-----------------------------------------------------------------------------------+
|                              SYSTEM SETTINGS TABS                                 |
+---------------------+-------------------+---------------------+-------------------+
| 1. General Config   | 2. Approval Rules | 3. Email (SMTP)     | 4. Security & WAF |
+---------------------+-------------------+---------------------+-------------------+
```

### 7.1 General Configuration
- **Application Name**: Display title across headers and automated communications.
- **Voucher Auto-Numbering Prefix**: Configurable sequence prefix (e.g., `REQ-2026-`).
- **Default Currency**: Default transaction currency (e.g., `INR`, `USD`, `EUR`).
- **Pagination Limit**: Default records per page in tables (default: 20).

### 7.2 Email Transport (SMTP)
Automated notifications for pending approvals, rejections, clarifications, and disbursements require an active SMTP gateway.

#### SMTP Configuration Parameters

| Setting Key | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `SMTP_HOST` | String | `smtp.gmail.com` | Hostname of mail transfer agent. |
| `SMTP_PORT` | Integer | `587` | Port number (`587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | String | `finance@yourcompany.com` | Authenticated SMTP username. |
| `SMTP_PASSWORD`| String | `********` | SMTP application password. |
| `SMTP_FROM` | String | `noreply@yourcompany.com` | Default sender email address. |

#### Testing Email Delivery
1. Navigate to the **Email Transport (SMTP)** tab.
2. Input SMTP server coordinates and save settings.
3. Click **Send Test Email**, input your email address, and click **Dispatch**.
4. Confirm receipt of the test notification.

### 7.3 Alert & SLA Policies
- **Pending Approval Reminder**: Automatically dispatch reminder notifications if an approver has not acted within **24 hours**, **48 hours**, or **72 hours**.
- **Real-Time Notification Delivery**: Enable WebSocket live alerts for users currently active on the platform.

### 7.4 Security & Storage Settings
- **Max Upload File Size**: Default `10485760` bytes (10 MB).
- **Permitted File Formats**: `pdf`, `png`, `jpg`, `jpeg`, `xlsx`.
- **Session Lifetimes**: Access token duration (default: 30 minutes); Refresh token duration (default: 7 days).
- **Lockout Threshold**: 5 failed login attempts with a 15-minute cooldown.

---

## 8. Viewing Audit Logs

The MV Payment Approval System maintains an **append-only, immutable audit trail** recording all system interactions. Audit logs cannot be modified or deleted through the application interface or API.

```
+-----------------------------------------------------------------------------------+
|                           IMMUTABLE AUDIT LOG ENTRY                               |
+-----------------------------------------------------------------------------------+
| Timestamp       : 2026-11-23T14:32:10Z                                            |
| Event Type      : REQUEST_APPROVED                                                |
| Entity          : PaymentRequest (REQ-2026-0891)                                  |
| Acting User     : Director Vikram Mehta (ID: d41d8cd9-8f00-4b11-9a72-...)         |
| Client IP       : 103.21.244.18 (Geo: Mumbai, IN)                                 |
| User Agent      : Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0       |
| State Change    : { status: "PENDING_APPROVAL" } -> { status: "APPROVED" }       |
| Financial Delta : Approved Amount: ₹4,50,000.00                                   |
| Hash Signature  : sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495...  |
+-----------------------------------------------------------------------------------+
```

### 8.1 Key Audited Event Types

| Event Category | Audit Event Types |
| :--- | :--- |
| **Authentication** | `USER_LOGIN`, `USER_LOGOUT`, `USER_LOGIN_FAILED`, `USER_LOCKED`, `PASSWORD_CHANGED` |
| **User Administration** | `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `ROLE_UPDATED` |
| **Payment Lifecycle** | `REQUEST_CREATED`, `REQUEST_UPDATED`, `REQUEST_SUBMITTED`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `CLARIFICATION_REQUESTED`, `CLARIFICATION_RESPONDED`, `PAYMENT_RECORDED`, `PAYMENT_COMPLETED`, `REQUEST_CANCELLED` |
| **Master Data** | `COMPANY_CREATED`, `COMPANY_UPDATED`, `DEPARTMENT_CREATED`, `VENDOR_CREATED`, `VENDOR_UPDATED` |
| **Configuration** | `SETTINGS_UPDATED`, `APPROVAL_RULE_CREATED`, `APPROVAL_RULE_MODIFIED` |

### 8.2 Inspecting and Exporting Logs
1. Navigate to **Administration** > **Audit Logs** (`/admin/audit-logs`).
2. Filter entries using the top toolbar:
   - **Event Type**: e.g., Filter by `REQUEST_APPROVED` or `USER_LOGIN_FAILED`.
   - **Date Range**: Select Start and End timestamps.
   - **User**: Filter actions performed by a specific user.
   - **Entity ID**: Filter all lifecycle events for a specific Voucher (e.g., `REQ-2026-0891`).
3. Click any row to expand the detailed JSON before/after state diff.
4. Click **Export Audit Trail** to download a cryptographically verifiable CSV or Excel ledger for compliance audits (SOC 2, ISO 27001, statutory tax audits).

---

## 9. Reports Overview

The Reports and Analytics module (`/admin/reports`) provides real-time financial visibility across all operating entities.

```
+-----------------------------------------------------------------------------------+
|                          EXECUTIVE REPORTING DASHBOARD                            |
+-----------------------------------------------------------------------------------+
| [Total Vouchers]      [Pending Approval]      [Approved & Unpaid]     [Disbursed] |
|     1,420                 ₹1.84 Cr                 ₹42.50 L            ₹18.60 Cr  |
+-----------------------------------------------------------------------------------+
```

### 9.1 Standard Reports Library

#### 1. Entity-Wide Expenditure Summary
- Breakdown of total disbursements grouped by legal company.
- Comparison of expenditures against allocated departmental budgets.

#### 2. Expense Category Distribution
- Analyzes expenditure by category: Raw Materials, Capital Expenditure (CAPEX), Logistics, Utilities, Professional Fees, Employee Reimbursements.
- Identifies unexpected cost spikes across fiscal quarters.

#### 3. Vendor Disbursement Analysis
- Top 20 payees ranked by total payout volume.
- Average days to payout per vendor.
- Tracks pending liabilities against due dates to avoid late payment penalties.

#### 4. Approval Cycle & SLA Turnaround Report
- Average duration (hours/days) required for vouchers to complete approval cycles.
- Bottleneck identification: Measures review latency across individual approvers and departments.

### 9.2 Exporting Reports
All reports can be exported in multiple formats:
- **Excel (.xlsx)**: Contains structured worksheets, financial formatting, and summary totals.
- **CSV (.csv)**: Clean tabular data for import into ERP systems (SAP, TallyPrime, Oracle NetSuite).
- **JSON**: Structured payloads for downstream data warehouse ingestion.

---

## 10. Backup and Maintenance

Reliable operations require automated database backups, log rotation, and periodic health checks.

### 10.1 Automated PostgreSQL Backup Script

Create a root cron job on your production server executing automated daily backups:

```bash
#!/usr/bin/env bash
# /opt/scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/var/backups/mv-payment"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mv_payment_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Dump PostgreSQL database directly from Docker container
docker compose -f /opt/mv-payment-approval/docker-compose.yml exec -T db \
  pg_dump -U postgres -d mv_payment_db | gzip > "${BACKUP_FILE}"

# Set permissions
chmod 600 "${BACKUP_FILE}"

# Prune backups older than 30 days
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +30 -delete

echo "[INFO] Database backup completed: ${BACKUP_FILE}"
```

Schedule in `crontab -e`:
```cron
# Execute nightly at 02:00 AM UTC
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/backup-db.log 2>&1
```

### 10.2 Restoring from Database Backup

```bash
# Decompress and restore into database container
gunzip < /var/backups/mv-payment/mv_payment_20261123_020000.sql.gz | \
  docker compose exec -T db psql -U postgres -d mv_payment_db
```

### 10.3 Backing Up Uploaded Attachments
Supporting documents (invoices, receipts) stored in `./uploads/documents` should be synchronized nightly to external encrypted object storage (e.g., AWS S3, Cloudflare R2):

```bash
# Sync local uploads directory to secure S3 bucket
aws s3 sync /opt/mv-payment-approval/uploads s3://company-payment-backups/uploads/ \
  --sse aws:kms \
  --delete
```

### 10.4 System Health Check Endpoints
Monitor application health using automated probes:
- **Liveness Probe**: `GET https://<your-domain>/health` &mdash; Returns `HTTP 200 {"status": "healthy"}`.
- **Readiness Probe**: `GET https://<your-domain>/api/health` &mdash; Verifies database connectivity and Redis responsiveness.

---

## 11. Security Best Practices for Administrators

1. **Enforce Strong Credentials**: Ensure all administrative accounts use complex passwords (minimum 12 characters with multi-class entropy). Rotate administrative credentials every 90 days.
2. **Mandatory MFA**: Enable Time-Based One-Time Passwords (TOTP) for all Super Admin and Director accounts.
3. **Restrict Network Access**: Ensure database port `5432` and Redis port `6379` are bound strictly to `127.0.0.1` or internal Docker networks, never exposed to public internet interfaces.
4. **Regular Audit Log Reviews**: Conduct weekly reviews of `USER_LOGIN_FAILED`, `USER_LOCKED`, and `SETTINGS_UPDATED` events in the audit trail.
5. **Prompt Deactivation**: Immediately deactivate user accounts (`is_active = false`) upon employee departure or role reassignment.
6. **Environment Variable Protection**: Safeguard the `.env` configuration file on the production server with restricted POSIX permissions:
   ```bash
   chmod 600 /opt/mv-payment-approval/.env
   chown root:root /opt/mv-payment-approval/.env
   ```
7. **Keep Dependencies Updated**: Regularly run security patches and container base image updates:
   ```bash
   docker compose pull
   docker compose up -d --build
   ```

---

*End of Administrator Guide — MV Payment Approval System v1.0.0 (November 2026)*
