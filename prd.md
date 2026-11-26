# MV Greentech - Product Requirements Document (PRD)

> **Document Version:** 2.1 (Production Release)  
> **Product Title:** Enterprise Payment Approval & Financial Authorization System  
> **Organization:** MV Greentech Global Pvt. Ltd.  
> **Target Audience:** Product Management, Engineering, Quality Assurance, Executive Leadership

---

## 1. Executive Summary & Problem Statement

### 1.1 The Challenge
Prior to the deployment of the MV Greentech Payment Approval System, the organization relied on fragmented communication channels (WhatsApp, paper vouchers, email threads) to authorize capital expenditures, vendor invoices, and employee expense claims. This resulted in:
1. **Prolonged Disbursement Cycles:** Average sales reimbursement turnaround took 14 to 21 business days.
2. **Financial Leakage & Over-budget Spends:** Lack of real-time visibility into pending departmental liabilities.
3. **Audit Vulnerability:** Absence of immutable digital audit logs for GST-compliant invoice verification and disbursement proof (UTRs).
4. **Friction for Field Sales:** Sales executives traveling for client demos had no straightforward mechanism to submit bills on-the-go.

### 1.2 The Solution
The **MV Greentech Payment Approval System** is a unified, progressive web application (PWA) and enterprise management portal providing automated multi-tiered payment workflows, real-time approval chains, vendor verification, employee reimbursement queues, and automated UTR reconciliation.

---

## 2. Target User Personas & Permissions Matrix

```
+-----------------------------------------------------------------------------------------+
|                               USER PERSONA DIRECTORY                                    |
+-------------------+----------------------+--------------------+-------------------------+
| Persona           | Primary Goal         | Pain Points        | System Access Level     |
+-------------------+----------------------+--------------------+-------------------------+
| **Sales Person /  | Submit travel claims | Manual paperwork,  | **Requester**           |
| Requester**       | & vendor invoices    | lost receipts,     | (Create, Read Own,      |
|                   | quickly from mobile  | payment delays     | Clarify, Cancel Draft)  |
+-------------------+----------------------+--------------------+-------------------------+
| **Director /      | Authorize expenditures| Approving blind    | **Approver / Director** |
| Approver**        | within limits; ensure| without invoices,  | (Read All, Approve,     |
|                   | budget compliance    | email clutter      | Reject, Clarify)        |
+-------------------+----------------------+--------------------+-------------------------+
| **Accountant /    | Execute bank payouts | Typos in account   | **Accountant**          |
| Finance Team**    | & log bank UTR       | numbers, missing   | (Read Approved, Disburse|
|                   | reference numbers    | vendor bank details| Record UTR, Reports)    |
+-------------------+----------------------+--------------------+-------------------------+
| **Super Admin**   | Maintain users, depts| User departures,   | **Super Administrator** |
|                   | entities, audit logs | rogue access       | (Full System Access,    |
|                   | & security policies  |                    | Deletion, Master Data)  |
+-------------------+----------------------+--------------------+-------------------------+
```

---

## 3. Core Functional Requirements (Epics & User Stories)

### Epic 1: Authentication & Access Control
- **US-1.1:** As any user, I can log in using my corporate email and password with secure JWT authentication.
- **US-1.2:** As an enterprise user, I can choose "Remember Me" to preserve my session safely for 30 days.
- **US-1.3:** As an IT administrator, I can be confident that 5 consecutive failed login attempts will lock the account or enforce an exponential cooldown to prevent brute-force attacks.
- **US-1.4:** As any user, I can reset my password securely using a one-time cryptographic reset token.

### Epic 2: Payment Voucher & Expense Reimbursement Creation
- **US-2.1 (Dual Payee Path):** As a Requester, I can choose whether the payment is for an **External Vendor** or an **Employee Expense Reimbursement**.
  - *If Vendor Selected:* The system prompts for Vendor selection, auto-populates vendor GSTIN and bank coordinates, and requires invoice number, date, and due date.
  - *If Employee Reimbursement Selected:* The system automatically populates the logged-in employee's name, bank account number, IFSC code, and UPI ID, without requiring vendor creation.
- **US-2.2 (Multi-file Attachments):** As a Requester, I can attach receipts, PDFs, photos of bills, or tax invoices (up to 10MB per file) directly to the voucher.
- **US-2.3 (Form Validation):** The system prevents submission if mandatory fields (amount > 0, currency, description, valid IFSC or bank details) are missing.

### Epic 3: Multi-Tier Approval Engine & Clarification Workflow
- **US-3.1 (Pending Approvals Queue):** As a Director, I can view all pending payment requests assigned to my authority level or department with clear indicators of urgency and due dates.
- **US-3.2 (Actionable Decisions):** As a Director, I can:
  - **Approve:** Authorize the voucher to immediately move to the Accountant's payment queue.
  - **Reject:** Decline the voucher with a mandatory justification comment recorded in the audit trail.
  - **Request Clarification:** Open an interactive inquiry thread with the Requester asking for additional details or modified bills without outright rejecting the claim.
- **US-3.3 (Clarification Resolution):** As a Requester, I can reply to clarification requests, upload additional documentation, and resubmit the voucher into the approval pipeline.

### Epic 4: Payment Disbursement & Reconciliation
- **US-4.1 (Accountant Payment Queue):** As an Accountant, I have a dedicated view of all **APPROVED** vouchers awaiting bank payout.
- **US-4.2 (Payment Execution Modal):** When disbursing funds, I can view verified payee bank coordinates (Account Number, IFSC, UPI ID), select the payment method (`NEFT`, `RTGS`, `IMPS`, `UPI`), enter the bank's **Unique Transaction Reference (UTR)** number, and confirm payment.
- **US-4.3 (Status Transition to PAID):** Once the UTR is logged, the voucher status permanently transitions to **PAID**, triggering notifications to both the Requester and Approver.

### Epic 5: Master Data & User Administration
- **US-5.1 (User Management):** As a Super Admin, I can view, search, filter, create, edit, and **permanently delete** user accounts.
- **US-5.2 (Company & Department Hierarchy):** As a Super Admin, I can manage multi-company legal entities, department codes (e.g. `FIN-01`, `OPS-01`), and approval thresholds.
- **US-5.3 (Vendor Directory):** As an Admin or Accountant, I can register vendors with GSTIN, PAN, MSME registration, bank account details, and contact persons.

### Epic 6: Financial Reports & Compliance Auditing
- **US-6.1 (Financial Analytics Dashboard):** Executives can review aggregate monthly disbursements, pending liability volume, department-wise expense distributions, and payment aging analytics.
- **US-6.2 (Audit Log Ledger):** Super Admins can inspect a chronological, immutable log of every action taken in the system, including IP addresses and payload diffs.
- **US-6.3 (Export Capabilities):** Financial reports and voucher lists can be exported directly to Excel/CSV for integration with external ERP systems (Tally, SAP, Zoho Books).

---

## 4. Non-Functional Requirements (NFRs)

### 4.1 Performance & Latency
- **API Response Time:** P95 latency for standard queries must remain below **100ms**; complex aggregated financial reports under **500ms**.
- **First Contentful Paint (FCP):** Frontend initial load under **1.2 seconds** via Vercel Edge CDN.

### 4.2 Security & Financial Compliance
- **Data in Transit:** Enforced HTTPS with TLS 1.3 across all subdomains.
- **Data at Rest:** AES-256 encrypted database storage on managed PostgreSQL.
- **Zero Mock Data Policy:** Production builds are strictly prohibited from utilizing mock/fallback memory arrays. All interfaces reflect live database states.
- **SQL Injection & XSS Safeguards:** All database operations utilize parameterized queries via SQLAlchemy 2.0 Async ORM; all frontend inputs sanitized by React JSX and Zod schemas.

### 4.3 Mobile & Progressive Web App (PWA) Standards
- Fully installable on Windows, macOS, Android, and iOS.
- Dynamic manifest displaying the official MV Greentech forest green logo.
- Automatic service worker cache invalidation on deployment.
- High-contrast responsive readability for field operations in sunlight.

---

## 5. Success Metrics & Key Performance Indicators (KPIs)

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Reimbursement Turnaround Time** | < 24 Hours | Timestamp delta: Voucher Creation -> Payout UTR Logged |
| **Approval Efficiency** | < 4 Hours | Timestamp delta: Voucher Submitted -> Director Decision |
| **Data Integrity & Reconciliation** | 100.0% | Zero unmatched bank disbursements against logged UTRs |
| **System Uptime** | >= 99.9% | Automated Render/Vercel continuous uptime monitors |
