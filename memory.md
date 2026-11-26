# MV Greentech - Project Memory & Architectural Decision Records (ADR)

> **Document Type:** Institutional Engineering Memory & Operational History  
> **Repository:** `https://github.com/akxcreative-ai/Mv-Greentech-Payment.git` (`main`)  
> **Last Verified:** November 2026 (Production Release v2.1)

---

## 1. Project Genesis & Core Mission

MV Greentech Global Pvt. Ltd. required an enterprise-grade financial disbursement authorization application to eliminate ad-hoc email approval chains, WhatsApp payment requests, and paper vouchers. Prior to this platform:
- Sales personnel incurred field expenses with delayed or untracked reimbursements.
- Vendor invoice payments lacked verified multi-level Director approval limits.
- The finance/accounts department had no centralized queue to verify payee bank details and record banking UTR numbers.

The system was constructed to establish an immutable, auditable, and automated digital ledger with strict role segregation.

---

## 2. Architectural Decision Records (ADRs)

### ADR-001: Asynchronous FastAPI + PostgreSQL vs. Synchronous Frameworks
* **Context:** The application handles concurrent financial approval requests, status transitions, notifications, and document attachment processing.
* **Decision:** Selected **FastAPI** with **SQLAlchemy 2.0 Async** and **asyncpg** over Django or Flask.
* **Consequences:** Near-instantaneous response times (< 40ms P95 latency), automatic OpenAPI/Swagger generation, native Pydantic v2 data validation, and non-blocking I/O during heavy reporting operations.

### ADR-002: Dual-Mode Payment Recipient Architecture (Vendor vs. Reimbursement)
* **Context:** Requester/Sales staff frequently need reimbursement for travel, client lodging, fuel, and minor operations. Previously, systems forced requesters to register themselves as external "vendors", polluting the vendor master database.
* **Decision:** Introduced first-class `recipient_type` (`VENDOR` | `EMPLOYEE_REIMBURSEMENT`) on the `payment_requests` table.
* **Implementation:**
  - When `recipient_type == 'EMPLOYEE_REIMBURSEMENT'`, the `vendor_id` foreign key is nullable.
  - The voucher directly stores employee bank account number, IFSC code, and UPI ID.
  - The UI dynamically hides vendor dropdowns and auto-populates the logged-in user's payment details.

### ADR-003: Pure Database Synchronization — Total Purge of Mock/Demo Data Fallbacks
* **Context:** Early prototypes contained hardcoded fallback mock arrays (`initialUsers`, `initialCompanies`, `FALLBACK_PENDING_REQUESTS`, etc.) in frontend stores. If an API call lagged or returned empty, mock data would populate the screen, leading to data confusion in production.
* **Decision:** In Commit `5186159`, deleted 1,600+ lines of mock dummy data across all frontend pages (`UserManagement`, `CompanyManagement`, `DepartmentManagement`, `VendorManagement`, `PendingApprovals`, `ApprovalDetail`, `PaymentTracking`, `SettingsPage`, `NotificationsPage`).
* **Consequence:** The frontend is 100% bound to real PostgreSQL database records. If a table is empty, a clean, professional empty state is rendered.

### ADR-004: Normalized Paginated API Responses
* **Context:** The frontend previously expected list responses as raw arrays (`Company[]`), while backend paginated endpoints returned structured envelopes (`{"items": [...], "total": 10}`). This caused frontend runtime crashes (`departments.map is not a function`).
* **Decision:**
  1. Standardized backend list models to provide both `items` and `data` aliases.
  2. Implemented frontend utility `normalizePaginated<T>` in API services to defensively parse both raw arrays and `{ items: [...] }` envelopes.
  3. Added `/all` unpaginated routes for master lookup lists (`companies`, `departments`, `vendors`).

### ADR-005: PWA Icon Resolution & SVG Precedence Fix
* **Context:** Even after updating `manifest.json` and PNG icons with the official green MV Greentech logo, Windows Edge and Chrome PWA install prompts continued to show an old dark navy circle with white "MV" text.
* **Root Cause Discovery:** Chromium-based browsers give higher priority to vector `.svg` icons in `public/icons/icon-192.svg` and `icon-512.svg` over raster PNGs, and aggressively cache Service Worker manifest payloads.
* **Decision & Fix:**
  - Directly overwrote `icon-192.svg` and `icon-512.svg` with embedded clean SVG representations of the official MV Greentech logo.
  - Bumped Service Worker cache version to `v2.0.2` with immediate skipWaiting and clients.claim activation.

---

## 3. Incident History & Resolved Bug Registry

| Incident ID | Severity | Problem Description | Root Cause | Permanent Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **INC-01** | High | Blank screen on `/payment-requests/new` when opening form | `departments.map is not a function` when backend returned paginated dictionary instead of flat array | Added `normalizePaginated` helper and safe array guards in `CreatePaymentRequest.tsx` |
| **INC-02** | Medium | Admin could not delete test or rogue users | Missing UI action and confirmation modal in `UserManagement.tsx` | Implemented `DELETE /api/v1/users/{id}` call with destructive confirmation modal and toast alerts |
| **INC-03** | Medium | PWA install banner showed old blue monogram | Browser cached `icon-192.svg` and `sw.js` `v2.0.1` | Replaced SVG vectors with official logo, bumped SW to `v2.0.2`, added auto-update in `main.tsx` |
| **INC-04** | Critical | Login failure `Authentication Error: Invalid email or password` | User tried logging in during clean production bootstrap before commit was committed | Verified all 4 core corporate accounts on live Render backend API; documented credentials |

---

## 4. Live Production Credentials & Infrastructure Registry

### 4.1 Deployment Endpoints
- **Frontend Portal (Vercel):**  
  `https://frontend-inky-sigma-84.vercel.app`
- **Backend API Core (Render):**  
  `https://mv-greentech-payment.onrender.com`
- **Interactive Swagger Documentation:**  
  `https://mv-greentech-payment.onrender.com/docs`
- **System Initialization Status Endpoint:**  
  `https://mv-greentech-payment.onrender.com/api/setup/status`

### 4.2 Official System Accounts (Verified Live)

| Role | Corporate Email | Password | Primary Functions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@mvgreentech.com` | `Admin@MVGreentech2026` | Master configuration, user creation/deletion, system settings |
| **Director / Approver** | `approver@mvgreentech.com` | `Approver@MVGreentech2026` | Review payment vouchers, approve/reject/request clarification |
| **Accountant / Finance** | `accountant@mvgreentech.com` | `Accountant@MVGreentech2026` | Execute transfers, verify bank/UPI coordinates, record UTR |
| **Requester / Sales Head** | `requester@mvgreentech.com` | `Requester@MVGreentech2026` | Create expense claims, employee reimbursements, track status |

### 4.3 Default Enterprise Master Data
- **Company:** MV Greentech (`MVG-01`) | Primary Color: `#0D5C3A`
- **Departments:**
  - `FIN-01`: Accounts & Finance
  - `OPS-01`: Operations
  - `PROC-01`: Procurement
  - `MGMT-01`: Management

---

## 5. Architectural Guardrails & Invariants

1. **Strictly No Mock Data in UI Components:** Every component must fetch data from services; if data is empty, display the branded `<EmptyState />` component.
2. **Never Store Plaintext Financial Identifiers in Local Storage:** Only short-lived access JWT tokens and normalized user identity metadata may be cached client-side.
3. **Mandatory Audit Logging for Financial Mutations:** Every approval, rejection, disbursement, and user deletion must record an immutable row in the `audit_logs` table with timestamp, IP address, and delta payload.
