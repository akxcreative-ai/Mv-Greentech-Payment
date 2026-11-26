# MV Greentech - Project Tracker & Release Roadmap

> **System:** Enterprise Payment Approval & Financial Authorization System  
> **Current Version:** `v2.1.0` (Production Verified)  
> **Repository:** `https://github.com/akxcreative-ai/Mv-Greentech-Payment.git` (`main`)  
> **Status:** Live & Operating in Cloud Production

---

## 1. Milestone Delivery Overview

| Milestone | Scope / Objectives | Target Date | Status | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Core Engine** | FastAPI Backend, PostgreSQL Models, JWT Auth, Basic React CRUD | Nov 2026 | **COMPLETED** | Tested & Verified |
| **Phase 2: Live Sync & Purge** | 100% Mock Data Removal, Normalization, Live API Synchronization | Nov 2026 | **COMPLETED** | Commit `5186159` |
| **Phase 3: Reimbursements** | Dual-path Employee Expenses without vendor requirement | Nov 2026 | **COMPLETED** | Commit `2cd4b02` |
| **Phase 4: Brand Identity & PWA** | MV Greentech Logo integration, Favicon, SW `v2.0.2`, Manifest | Nov 2026 | **COMPLETED** | Commit `ddd51a0` |
| **Phase 5: Automation & Banking** | Direct Bank Payout Gateway (RazorpayX), OCR Invoice Reading | Q1 2027 | **PLANNED** | Concept Architecture |

---

## 2. Feature Implementation Status Matrix

### 2.1 Identity, Authentication & Organization

| Feature / Capability | Frontend Component | Backend Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **JWT Login & Refresh** | `LoginPage.tsx` | `POST /api/v1/auth/login` | `100% DONE` | Verified with all 4 corporate roles |
| **Session Protection** | `AuthGuard.tsx` | `GET /api/v1/auth/me` | `100% DONE` | Automatic silent token refresh |
| **Role-Based Guards** | `RoleGuard` | `Depends(require_permission)` | `100% DONE` | Super Admin, Director, Accountant, Requester |
| **User Management** | `UserManagement.tsx`| `/api/v1/users` | `100% DONE` | Live DB sync + Permanent deletion |
| **Company Management**| `CompanyManagement.tsx` | `/api/v1/companies` | `100% DONE` | Multi-company & branding color support |
| **Department Hierarchy**| `DepartmentManagement.tsx`| `/api/v1/departments` | `100% DONE` | Linked to company entities |

### 2.2 Payment Requests & Expense Reimbursements

| Feature / Capability | Frontend Component | Backend Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Vendor Payment Voucher** | `CreatePaymentRequest.tsx` | `POST /api/v1/payment-requests` | `100% DONE` | GSTIN, Vendor Bank, Tax deduction |
| **Employee Expense Claim** | `CreatePaymentRequest.tsx` | `POST /api/v1/payment-requests` | `100% DONE` | Self-payee, Direct IFSC & UPI transfer |
| **Document Attachments** | `FileUploadDropzone.tsx` | `POST /api/v1/documents/upload` | `100% DONE` | PDF, PNG, JPG receipts (up to 10MB) |
| **Voucher Tracking** | `PaymentTracking.tsx` | `GET /api/v1/payment-requests/{id}` | `100% DONE` | Interactive timeline & status history |
| **My Requests Queue** | `MyRequests.tsx` | `GET /api/v1/payment-requests/my` | `100% DONE` | Filterable by status and dates |

### 2.3 Approvals, Clarifications & Disbursement

| Feature / Capability | Frontend Component | Backend Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Director Pending Queue**| `PendingApprovals.tsx` | `GET /api/v1/approvals/pending` | `100% DONE` | Filter by urgency & due date |
| **Approval / Rejection** | `ApprovalDetail.tsx` | `POST /api/v1/approvals/{id}/action`| `100% DONE` | Rejection requires mandatory comment |
| **Interactive Clarification**| `ApprovalDetail.tsx` | `POST /api/v1/approvals/{id}/clarify`| `100% DONE`| 2-way chat between Director & Requester |
| **Accountant Payment Queue**| `PaymentProcessing.tsx`| `GET /api/v1/payments/pending` | `100% DONE` | Verified bank coordinates modal |
| **Disbursement & UTR Logging**| `PaymentProcessing.tsx`| `POST /api/v1/payments` | `100% DONE` | Generates immutable settlement record |
| **Completed Payments** | `CompletedPayments.tsx` | `GET /api/v1/payments/completed` | `100% DONE` | Searchable by UTR & Payee |

### 2.4 Reports, Audit & Mobile PWA

| Feature / Capability | Frontend Component | Backend Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Financial Analytics** | `Reports.tsx` | `GET /api/v1/reports/summary` | `100% DONE` | Monthly volume, Category spends |
| **Compliance Audit Logs**| `AuditLogs.tsx` | `GET /api/v1/audit-logs` | `100% DONE` | IP address, timestamp, diff payload |
| **Excel / CSV Export** | `Reports.tsx` | `GET /api/v1/reports/export` | `100% DONE` | Downloadable tabular financial records |
| **PWA Web Manifest** | `manifest.json` | Public Asset | `100% DONE` | Branded standalone app frame |
| **Offline Fallback** | `sw.js` (v2.0.2) | `/offline.html` | `100% DONE` | Network-first with offline page |

---

## 3. Bug Fix & Hotfix Registry

| Issue Key | Severity | Description | Status | Resolution Commit |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-101** | High | `departments.map is not a function` blank screen on create request | `FIXED` | Commit `5186159` (Normalized paginated API response) |
| **BUG-102** | Medium | User deletion button missing from Super Admin user management table | `FIXED` | Commit `7d48ce9` (Added delete action + confirmation modal) |
| **BUG-103** | Medium | Requester could not raise travel expenses without creating a dummy vendor | `FIXED` | Commit `2cd4b02` (Added `recipient_type` employee reimbursement) |
| **BUG-104** | Low | Native PWA prompt displayed old navy blue monogram in Edge/Chrome | `FIXED` | Commit `ddd51a0` (Replaced SVG icons & bumped SW cache to v2.0.2) |
| **BUG-105** | High | Mock data fallback displayed outdated entries if backend lagged | `FIXED` | Commit `5186159` (Purged 1,600+ lines of mock dummy data) |

---

## 4. Operational Health & Live Deployment Status

- **Frontend Application:**  
  URL: `https://frontend-inky-sigma-84.vercel.app`  
  Deployment: Continuous Delivery via Vercel Edge Global  
  Status: **ACTIVE / GREEN**
- **Backend API Gateway:**  
  URL: `https://mv-greentech-payment.onrender.com`  
  Deployment: Render Cloud Container (Python 3.11 + FastAPI)  
  Status: **ACTIVE / GREEN**
- **Database Engine:**  
  Engine: Managed PostgreSQL 16 (Render Cloud)  
  Connection Pool: Asyncpg connection pool  
  Status: **ACTIVE / HEALTHY**

---

## 5. Future Engineering Roadmap (2027)

```
+-----------------------------------------------------------------------------------+
|                           FUTURE INNOVATION ROADMAP                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Q1 2027 ] -----------------------------------------------------------------+   |
|  * AI Optical Character Recognition (OCR) Engine                              |   |
|    - Automatic bill scanning, GSTIN extraction, date, and amount extraction   |   |
|    - Drag-and-drop bill slip -> form auto-populates in < 2 seconds            |   |
|                                                                               |   |
|  [ Q2 2027 ] -------------------------------------------------------------+   |   |
|  * Automated Bank Payment Gateway Integration (RazorpayX / Cashfree)       |   |   |
|    - Instant 1-click NEFT/IMPS payout directly from Accountant portal     |   |   |
|    - Webhook-driven instant UTR capture without manual data entry         |   |   |
|                                                                               |   |
|  [ Q3 2027 ] ---------------------------------------------------------+   |   |   |
|  * WhatsApp / Push Notification Webhooks                               |   |   |   |
|    - Immediate interactive WhatsApp action button for Directors:      |   |   |   |
|      "Approve ₹ 1,50,000 for Vendor X?" -> Click [Approve]             |   |   |   |
|                                                                               |   |
+-------------------------------------------------------------------------------+---+
```
