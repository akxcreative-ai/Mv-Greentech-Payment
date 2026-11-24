# MV Payment Approval System — REST API Specification

```
Document Version : 1.0.0
Release Date     : November 2026
Specification    : OpenAPI 3.1.0 Compatible REST API
Base Protocol    : HTTPS (TLS 1.3 / TLS 1.2)
Data Format      : JSON (application/json) / Multipart Form Data (uploads)
Authentication   : JSON Web Token (JWT) Bearer Authentication
```

---

## Table of Contents

- [1. Overview & Base URLs](#1-overview--base-urls)
- [2. Authentication & Authorization](#2-authentication--authorization)
- [3. Standard Response & Error Envelope](#3-standard-response--error-envelope)
- [4. Rate Limiting Policy](#4-rate-limiting-policy)
- [5. API Endpoints by Module](#5-api-endpoints-by-module)
  - [5.1 Authentication (`/api/auth`)](#51-authentication-apiauth)
  - [5.2 Initial Setup (`/api/setup`)](#52-initial-setup-apisetup)
  - [5.3 Users (`/api/users`)](#53-users-apiusers)
  - [5.4 Companies (`/api/companies`)](#54-companies-apicompanies)
  - [5.5 Departments (`/api/departments`)](#55-departments-apidepartments)
  - [5.6 Vendors (`/api/vendors`)](#56-vendors-apivendors)
  - [5.7 Payment Requests (`/api/payment-requests`)](#57-payment-requests-apipayment-requests)
  - [5.8 Approvals (`/api/approvals`)](#58-approvals-apiapprovals)
  - [5.9 Payments & Disbursements (`/api/payments`)](#59-payments--disbursements-apipayments)
  - [5.10 Notifications (`/api/notifications`)](#510-notifications-apinotifications)
  - [5.11 Reports & Dashboards (`/api/reports`)](#511-reports--dashboards-apireports)
  - [5.12 Settings & Approval Rules (`/api/settings`)](#512-settings--approval-rules-apisettings)
  - [5.13 Audit Logs (`/api/audit-logs`)](#513-audit-logs-apiaudit-logs)
- [6. Error Codes & Troubleshooting Reference](#6-error-codes--troubleshooting-reference)

---

## 1. Overview & Base URLs

The **MV Payment Approval System API** provides programmatically accessible endpoints to manage corporate companies, departments, users, payment vouchers, multi-tier approvals, banking disbursements, and immutable audit logs.

### Server Environments

| Environment | Base URL | Description |
| :--- | :--- | :--- |
| **Production** | `https://payment.yourcompany.com/api` | Primary cloud production gateway with TLS 1.3 |
| **Staging** | `https://staging-payment.yourcompany.com/api` | Pre-production testing environment |
| **Local Development** | `http://localhost:8000/api` | Local Docker or bare-metal development server |

### Interactive Documentation UI
When running in development or staging modes:
- **Swagger / OpenAPI UI**: `https://<host>/docs`
- **ReDoc UI**: `https://<host>/redoc`
- **OpenAPI JSON Schema**: `https://<host>/openapi.json`

---

## 2. Authentication & Authorization

All API endpoints (except `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/setup/init`) require a valid **JSON Web Token (JWT)** passed in the HTTP `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### JWT Architecture
- **Algorithm**: `HS256` (HMAC SHA-256) with minimum 256-bit secret entropy.
- **Access Token Lifespan**: 30 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES=30`).
- **Refresh Token Lifespan**: 7 days (`REFRESH_TOKEN_EXPIRE_DAYS=7`).
- **Revocation**: Refresh tokens are tracked in Redis and revoked upon logout or password rotation.

### JWT Payload Structure
```json
{
  "sub": "user_id_uuid",
  "email": "user@yourcompany.com",
  "role": "accountant",
  "company_id": "comp_uuid_here",
  "exp": 1795435200,
  "iat": 1795433400
}
```

---

## 3. Standard Response & Error Envelope

All API responses return JSON with standardized structures.

### Standard Success Response (Example)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### Standard Error Response (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": "HTTP Error",
  "message": "Detailed human-readable error description.",
  "status_code": 400,
  "request_id": "req_trace_uuid_here"
}
```

### Input Validation Error (HTTP 422 Unprocessable Entity)
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Input validation failed. Please check the supplied attributes.",
  "details": [
    {
      "field": "body -> amount",
      "message": "Input should be greater than 0",
      "type": "greater_than"
    }
  ]
}
```

---

## 4. Rate Limiting Policy

Rate limiting is enforced at both the **Nginx edge reverse proxy** and the **FastAPI SlowAPI application middleware** to mitigate denial-of-service and brute-force credential stuffing.

| Endpoint Category | Edge Proxy Limit | Application Limit | Scope |
| :--- | :--- | :--- | :--- |
| **Authentication** (`/api/auth/*`) | 5 req/sec (burst 10) | 10 requests / minute | Per Client IP |
| **Document Uploads** (`/api/payment-requests/*/documents`) | 10 req/sec (burst 20) | 30 requests / minute | Per User ID |
| **General Financial Endpoints** | 30 req/sec (burst 50) | 120 requests / minute | Per Token / IP |
| **Reports & Exports** | 5 req/sec (burst 10) | 20 requests / minute | Per User ID |

### Rate Limit Headers (Sent with responses)
- `X-RateLimit-Limit`: Maximum permitted requests per window.
- `X-RateLimit-Remaining`: Remaining requests in current window.
- `Retry-After`: Seconds to wait before retrying (when `HTTP 429` is returned).

---

## 5. API Endpoints by Module

---

### 5.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
Authenticates a user using email and password.

- **Access Level**: Public
- **Request Body**:
```json
{
  "email": "priya.nair@mvagro.com",
  "password": "UserPass2026!#"
}
```
- **Response** (`200 OK`):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "d98124b8-4c92-411a-9f82-a0918237192a",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "4f18b41e-3c2d-4d7a-8f4b-0e123456789a",
    "email": "priya.nair@mvagro.com",
    "first_name": "Priya",
    "last_name": "Nair",
    "full_name": "Priya Nair",
    "role_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "role": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "accountant",
      "display_name": "Accountant / Finance",
      "permissions": {
        "payment_requests": ["read"],
        "payments": ["read", "record", "complete"]
      }
    },
    "department_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
    "is_active": true,
    "email_verified": true,
    "phone": "+91 98765 43210",
    "avatar_url": null,
    "last_login": "2026-11-23T10:14:00Z",
    "created_at": "2026-01-15T08:00:00Z"
  }
}
```

#### `POST /api/auth/logout`
Invalidates the current session and blacklists the refresh token in Redis.

- **Access Level**: Authenticated (`Bearer <token>`)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "User session successfully terminated."
}
```

#### `POST /api/auth/refresh`
Exchanges an active refresh token for a fresh access token.

- **Request Body**:
```json
{
  "refresh_token": "d98124b8-4c92-411a-9f82-a0918237192a"
}
```
- **Response** (`200 OK`): Returns updated `TokenResponse`.

#### `POST /api/auth/forgot-password`
Generates a signed password reset token dispatched to the user's email address.

- **Request Body**:
```json
{
  "email": "priya.nair@mvagro.com"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "If the account exists, password reset instructions have been dispatched."
}
```

#### `POST /api/auth/reset-password`
Sets a new account password using a validated reset token.

- **Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.reset_token_payload...",
  "new_password": "NewStrongPass2026!#"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Password has been successfully updated. Please log in with your new credentials."
}
```

#### `GET /api/auth/me`
Retrieves the profile and permissions of the currently authenticated user.

- **Access Level**: Authenticated
- **Response** (`200 OK`): Returns `UserProfileResponse`.

#### `PUT /api/auth/change-password`
Enables an active user to change their account password.

- **Request Body**:
```json
{
  "current_password": "OldPassword2026!#",
  "new_password": "BrandNewPassword2026!#"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

---

### 5.2 Initial Setup (`/api/setup`)

#### `POST /api/setup/init`
One-time bootstrap endpoint to initialize default system roles and create the first Super Administrator.

- **Access Level**: Public (Only when 0 users exist in the database)
- **Request Body**:
```json
{
  "email": "superadmin@mvholdings.com",
  "password": "MasterAdminPass2026!#",
  "first_name": "Global",
  "last_name": "Administrator"
}
```
- **Response** (`201 Created`):
```json
{
  "id": "e0a1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
  "email": "superadmin@mvholdings.com",
  "first_name": "Global",
  "last_name": "Administrator",
  "full_name": "Global Administrator",
  "role_id": "super_admin_role_id",
  "is_active": true,
  "created_at": "2026-11-23T09:00:00Z",
  "message": "Initial administrator and system roles configured successfully."
}
```
- **Error** (`403 Forbidden`): Returned if any user already exists.

---

### 5.3 Users (`/api/users`)

#### `GET /api/users`
Lists system users with pagination and administrative filtering.

- **Access Level**: `super_admin`
- **Query Parameters**:
  - `page` (int, default: 1)
  - `page_size` (int, default: 20)
  - `search` (string, optional): Search by name or email
  - `role_id` (UUID, optional)
  - `company_id` (UUID, optional)
  - `department_id` (UUID, optional)
  - `is_active` (bool, optional)
- **Response** (`200 OK`):
```json
{
  "items": [
    {
      "id": "4f18b41e-3c2d-4d7a-8f4b-0e123456789a",
      "email": "priya.nair@mvagro.com",
      "first_name": "Priya",
      "last_name": "Nair",
      "full_name": "Priya Nair",
      "role_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "department_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
      "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
      "is_active": true,
      "is_locked": false,
      "email_verified": true,
      "phone": "+91 98765 43210",
      "avatar_url": null,
      "last_login": "2026-11-23T10:14:00Z",
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-11-20T12:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

#### `POST /api/users`
Provisions a new system user account.

- **Access Level**: `super_admin`
- **Request Body**:
```json
{
  "email": "vikram.mehta@mvholdings.com",
  "password": "TempPassword2026!#",
  "first_name": "Vikram",
  "last_name": "Mehta",
  "role_id": "director_role_uuid",
  "company_id": "company_uuid_here",
  "department_id": "department_uuid_here",
  "phone": "+91 98220 12345",
  "is_active": true
}
```
- **Response** (`201 Created`): Returns `UserDetailResponse`.

#### `GET /api/users/approvers`
Returns active users possessing approval privileges (`department_head`, `director`, `super_admin`) for dropdown assignment.

- **Access Level**: Authenticated
- **Response** (`200 OK`): Array of approver user objects.

#### `GET /api/users/{id}`
Retrieves a single user's detailed profile.

#### `PUT /api/users/{id}`
Updates user attributes (role assignment, department, active status, phone).

#### `DELETE /api/users/{id}`
Soft-deactivates a user account (`is_active = false`).

---

### 5.4 Companies (`/api/companies`)

#### `GET /api/companies/`
Lists all registered operating companies.

- **Access Level**: Authenticated
- **Query Parameters**: `is_active` (bool, optional)
- **Response** (`200 OK`):
```json
[
  {
    "id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
    "name": "MV Agro Industries Ltd",
    "code": "MVAGRO",
    "gst_number": "27AABCM8891J1ZP",
    "pan_number": "AABCM8891J",
    "address": "Plot 42, MIDC Industrial Area, Pune 411018",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

#### `POST /api/companies/`
Creates a new corporate legal entity.

- **Access Level**: `super_admin`
- **Request Body**:
```json
{
  "name": "MV Digital Technologies Private Limited",
  "code": "MVTECH",
  "gst_number": "27AAACD9910K1ZS",
  "pan_number": "AAACD9910K",
  "address": "Tower 4, Cyber City, Bangalore, Karnataka 560100",
  "is_active": true
}
```
- **Response** (`201 Created`): Returns created company object.

#### `GET /api/companies/{id}` & `PUT /api/companies/{id}` & `DELETE /api/companies/{id}`
Retrieve, update, or soft-delete a company.

---

### 5.5 Departments (`/api/departments`)

#### `GET /api/departments/`
Lists departments, filterable by parent company.

- **Access Level**: Authenticated
- **Query Parameters**: `company_id` (UUID, optional), `is_active` (bool, optional)
- **Response** (`200 OK`): List of department objects.

#### `POST /api/departments/`
Creates a new department within a company.

- **Access Level**: `super_admin`
- **Request Body**:
```json
{
  "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "name": "Procurement & Raw Materials",
  "code": "DEPT-PROC",
  "head_id": "user_uuid_here",
  "budget": 15000000.00,
  "is_active": true
}
```
- **Response** (`201 Created`): Returns created department object.

---

### 5.6 Vendors (`/api/vendors`)

#### `GET /api/vendors`
Retrieves registered vendors with search and category filtering.

- **Access Level**: Authenticated
- **Query Parameters**: `search` (string), `category` (string), `page` (int), `page_size` (int)
- **Response** (`200 OK`):
```json
{
  "items": [
    {
      "id": "v1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "name": "Tata Steel Limited",
      "vendor_code": "VND-TATA-01",
      "category": "RAW_MATERIALS",
      "gst_number": "27AAACT2727Q1ZW",
      "pan_number": "AAACT2727Q",
      "contact_person": "Anand Kulkarni",
      "email": "payments@tatasteel.com",
      "phone": "+91 22 6665 8282",
      "bank_name": "State Bank of India",
      "account_number": "••••••••4819",
      "ifsc_code": "SBIN0000300",
      "branch_name": "Industrial Finance Branch, Mumbai",
      "is_active": true,
      "created_at": "2026-01-10T10:00:00Z"
    }
  ],
  "total": 120,
  "page": 1,
  "page_size": 20,
  "pages": 6
}
```

#### `POST /api/vendors`
Registers a new payee vendor.

- **Access Level**: `super_admin`, `accountant`
- **Request Body**:
```json
{
  "name": "Amazon Web Services India Pvt Ltd",
  "vendor_code": "VND-AWS-02",
  "category": "IT_SOFTWARE",
  "gst_number": "27AABCA1234D1ZX",
  "pan_number": "AABCA1234D",
  "contact_person": "Enterprise Billing Support",
  "email": "aws-in-billing@amazon.com",
  "phone": "+91 80 4000 0000",
  "bank_name": "HDFC Bank",
  "account_number": "50200012345678",
  "ifsc_code": "HDFC0000128",
  "branch_name": "Kharadi IT Park Branch, Pune",
  "is_active": true
}
```
- **Response** (`201 Created`): Returns created vendor profile.

#### `GET /api/vendors/{id}/bank-details`
Reveals unmasked banking coordinates for payment disbursement.

- **Access Level**: `super_admin`, `accountant` (Restricted to financial disbursement roles).

---

### 5.7 Payment Requests (`/api/payment-requests`)

#### `GET /api/payment-requests`
Lists payment vouchers matching filter criteria.

- **Access Level**: Authenticated
- **Query Parameters**:
  - `company_id` (UUID)
  - `department_id` (UUID)
  - `vendor_id` (UUID)
  - `status` (Enum: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CLARIFICATION_REQUIRED`, `PAYMENT_PROCESSING`, `PAID`, `CANCELLED`)
  - `priority` (Enum: `LOW`, `NORMAL`, `HIGH`, `URGENT`)
  - `search` (string: invoice number, request number, purpose)
  - `page` (int, default: 1), `page_size` (int, default: 20)
- **Response** (`200 OK`): Paginated payment voucher summaries.

#### `POST /api/payment-requests`
Initiates a new payment request voucher.

- **Access Level**: `accountant`, `department_head`, `super_admin`
- **Request Body**:
```json
{
  "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "department_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "vendor_id": "v1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
  "expense_category": "RAW_MATERIALS",
  "expense_subcategory": "Hot Rolled Sheets",
  "payment_purpose": "Procurement of Q4 production raw steel coils for Plant 2 manufacturing line.",
  "invoice_number": "INV-2026-9921",
  "invoice_date": "2026-11-18T00:00:00Z",
  "due_date": "2026-12-05T00:00:00Z",
  "amount": 381355.93,
  "gst_amount": 68644.07,
  "total_amount": 450000.00,
  "payment_mode": "RTGS",
  "priority": "HIGH",
  "remarks": "Priority supply needed before quarterly maintenance shutdown.",
  "is_duplicate_override": false,
  "duplicate_override_reason": null
}
```
- **Response** (`201 Created`):
```json
{
  "id": "7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
  "request_number": "REQ-2026-0891",
  "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "department_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
  "requested_by_id": "4f18b41e-3c2d-4d7a-8f4b-0e123456789a",
  "vendor_id": "v1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
  "expense_category": "RAW_MATERIALS",
  "payment_purpose": "Procurement of Q4 production raw steel coils...",
  "invoice_number": "INV-2026-9921",
  "total_amount": 450000.00,
  "payment_mode": "RTGS",
  "priority": "HIGH",
  "status": "DRAFT",
  "created_at": "2026-11-23T11:00:00Z"
}
```

#### `GET /api/payment-requests/{id}`
Returns complete details of a payment voucher, including attached documents, approval decisions, clarification thread, and payment records.

#### `POST /api/payment-requests/{id}/submit`
Submits a `DRAFT` voucher into the approval pipeline. Evaluates amount rules and assigns the active approver.

- **Response** (`200 OK`): Updates status to `PENDING_APPROVAL`.

#### `POST /api/payment-requests/{id}/check-duplicate`
Pre-checks if an invoice number and vendor combination already exists in the system.

- **Response** (`200 OK`):
```json
{
  "is_duplicate": true,
  "existing_request_id": "prior_voucher_uuid",
  "existing_request_number": "REQ-2026-0412",
  "existing_status": "PAID",
  "message": "Warning: Matching invoice number exists for this vendor."
}
```

#### `POST /api/payment-requests/{id}/documents`
Attaches a supporting invoice or document.

- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `file`: Binary file stream (max 10 MB, allowed formats: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.xlsx`)
- **Response** (`201 Created`):
```json
{
  "id": "doc_uuid_here",
  "file_name": "b3e9a182_invoice.pdf",
  "original_name": "Tax_Invoice_9921.pdf",
  "file_size": 2481920,
  "mime_type": "application/pdf",
  "created_at": "2026-11-23T11:05:00Z"
}
```

#### `GET /api/payment-requests/{id}/documents/{doc_id}/download`
Streams the stored file binary with strict `Content-Disposition` attachment headers.

#### `DELETE /api/payment-requests/{id}/documents/{doc_id}`
Soft-deletes an attached document (permitted only while voucher is in `DRAFT`).

---

### 5.8 Approvals (`/api/approvals`)

#### `GET /api/approvals/pending`
Lists vouchers requiring approval by the authenticated user or their managerial role.

- **Access Level**: `department_head`, `director`, `super_admin`
- **Response** (`200 OK`): Array of payment requests in `PENDING_APPROVAL` status.

#### `POST /api/approvals/{request_id}/approve`
Signs and approves a payment request.

- **Access Level**: `department_head`, `director`, `super_admin`
- **Anti-Fraud Guard**: **Fails with HTTP 403 if `requester_id == approver_id` (Self-approval strictly forbidden).**
- **Request Body**:
```json
{
  "approved_amount": 450000.00,
  "comment": "Approved in accordance with Q4 raw material purchase order PO-2026-881."
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "approval_status": "APPROVED",
  "message": "Payment request REQ-2026-0891 successfully approved.",
  "escalated_to_next_tier": false
}
```

#### `POST /api/approvals/{request_id}/reject`
Declines a payment request with a mandatory justification.

- **Request Body**:
```json
{
  "comment": "Rejected due to missing delivery confirmation receipt. Please obtain GRN."
}
```
- **Response** (`200 OK`): Moves voucher to `REJECTED` status.

#### `POST /api/approvals/{request_id}/clarify`
Suspends approval and issues a formal clarification request to the requester.

- **Request Body**:
```json
{
  "message": "Please confirm if the 2% early payment cash discount was deducted."
}
```
- **Response** (`200 OK`): Moves voucher to `CLARIFICATION_REQUIRED`.

#### `POST /api/approvals/{request_id}/respond`
Allows the requester to reply to a clarification inquiry and return the voucher to review.

- **Request Body**:
```json
{
  "message": "Confirmed: 2% cash discount is reflected in line item 3 of the amended invoice."
}
```
- **Response** (`200 OK`): Returns voucher to `PENDING_APPROVAL`.

#### `GET /api/approvals/{request_id}/history`
Returns the complete audit sequence of approval decisions and clarification dialogue messages.

---

### 5.9 Payments & Disbursements (`/api/payments`)

#### `POST /api/payments/{request_id}/record`
Records the execution of a financial disbursement for an `APPROVED` voucher.

- **Access Level**: `accountant`, `super_admin` (Approvers cannot execute disbursements)
- **Request Body**:
```json
{
  "actual_amount": 450000.00,
  "payment_mode": "RTGS",
  "payment_date": "2026-11-23T14:30:00Z",
  "bank_account": "HDFC Corp A/C 9901823712",
  "transaction_id": "HDFCTXN88192019",
  "utr_number": "HDFCR520261123991823",
  "cheque_number": null,
  "payment_reference": "SAP-DOC-2026-10928",
  "remarks": "Disbursed via HDFC Corporate Direct NetBanking."
}
```
- **Response** (`201 Created`):
```json
{
  "id": "pay_rec_uuid_here",
  "payment_request_id": "7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
  "actual_amount": 450000.00,
  "payment_mode": "RTGS",
  "utr_number": "HDFCR520261123991823",
  "status": "PAID",
  "paid_at": "2026-11-23T14:30:00Z"
}
```

#### `POST /api/payments/{request_id}/complete`
Verifies bank settlement and transitions voucher to final `COMPLETED` state.

#### `GET /api/payments/{request_id}`
Returns all disbursement records and bank UTRs linked to a payment request.

---

### 5.10 Notifications (`/api/notifications`)

#### `GET /api/notifications`
Retrieves in-app notifications for the logged-in user.

- **Query Parameters**: `is_read` (bool, optional), `page` (int), `page_size` (int)
- **Response** (`200 OK`): Paginated notifications list.

#### `GET /api/notifications/unread-count`
Returns the real-time integer count of unread notifications.

- **Response** (`200 OK`): `{"unread_count": 4}`

#### `PUT /api/notifications/{id}/read`
Marks a specific notification as read.

#### `PUT /api/notifications/read-all`
Marks all notifications as read for the current user.

---

### 5.11 Reports & Dashboards (`/api/reports`)

#### `GET /api/reports/dashboard/admin`
Returns system-wide financial telemetry for Super Administrators.

- **Response** (`200 OK`):
```json
{
  "total_vouchers": 1420,
  "pending_approval_count": 28,
  "pending_approval_amount": 18450000.00,
  "approved_unpaid_count": 14,
  "approved_unpaid_amount": 4250000.00,
  "paid_this_month": 186000000.00,
  "average_approval_hours": 18.4,
  "company_summaries": [ ... ]
}
```

#### `GET /api/reports/dashboard/approver`
Returns pending queue metrics and SLA deadlines for the authenticated approver.

#### `GET /api/reports/dashboard/accountant`
Returns cash flow projections and pending disbursements for finance teams.

#### `GET /api/reports/{type}`
Generates tabular reporting data.
- **Valid Types**: `expense-by-category`, `vendor-spend`, `department-spend`, `monthly-trend`, `turnaround-time`.

#### `GET /api/reports/{type}/export`
Streams downloadable report files.
- **Query Parameter**: `format` (`xlsx` or `csv`).

---

### 5.12 Settings & Approval Rules (`/api/settings`)

#### `GET /api/settings` & `PUT /api/settings/{key}`
Inspect or update global system parameters (SMTP, timeouts, file limits).

- **Access Level**: `super_admin`

#### `GET /api/settings/approval-rules`
Lists tiered approval threshold rules.

- **Query Parameters**: `company_id` (UUID, optional)
- **Response** (`200 OK`):
```json
[
  {
    "id": "rule_001_uuid",
    "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
    "min_amount": 0.00,
    "max_amount": 200000.00,
    "requires_approval": true,
    "approver_role": "department_head",
    "is_active": true
  },
  {
    "id": "rule_002_uuid",
    "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
    "min_amount": 200000.01,
    "max_amount": null,
    "requires_approval": true,
    "approver_role": "director",
    "is_active": true
  }
]
```

#### `POST /api/settings/approval-rules`
Defines a new monetary threshold tier for a company.

- **Request Body**:
```json
{
  "company_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
  "min_amount": 1000000.01,
  "max_amount": null,
  "requires_approval": true,
  "approver_role": "director",
  "is_active": true
}
```

#### `PUT /api/settings/approval-rules/{id}` & `DELETE /api/settings/approval-rules/{id}`
Update or deactivate threshold rules.

---

### 5.13 Audit Logs (`/api/audit-logs`)

#### `GET /api/audit-logs`
Queries the immutable audit trail.

- **Access Level**: `super_admin`
- **Query Parameters**:
  - `event_type` (Enum: `USER_LOGIN`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `PAYMENT_RECORDED`, etc.)
  - `entity_type` (e.g. `payment_request`, `user`, `vendor`)
  - `user_id` (UUID)
  - `start_date` & `end_date` (ISO 8601 Timestamps)
  - `page` (int), `page_size` (int)
- **Response** (`200 OK`):
```json
{
  "items": [
    {
      "id": "audit_uuid_here",
      "timestamp": "2026-11-23T14:32:10Z",
      "event_type": "REQUEST_APPROVED",
      "entity_type": "payment_request",
      "entity_id": "7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
      "user_id": "director_uuid_here",
      "user_email": "vikram.mehta@mvholdings.com",
      "ip_address": "103.21.244.18",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
      "previous_value": {
        "status": "PENDING_APPROVAL"
      },
      "new_value": {
        "status": "APPROVED",
        "approved_amount": 450000.00,
        "comment": "Approved as per PO-2026-881"
      }
    }
  ],
  "total": 3840,
  "page": 1,
  "page_size": 20
}
```

---

## 6. Error Codes & Troubleshooting Reference

The API uses standard HTTP status codes. Refer to the diagnostic table below:

| HTTP Status | Meaning | Typical Trigger | Recommended Client Resolution |
| :---: | :--- | :--- | :--- |
| **`400 Bad Request`** | Malformed Syntax | Invalid JSON payload, malformed query parameters, or missing mandatory header. | Inspect request payload syntax against API spec. |
| **`401 Unauthorized`** | Authentication Failure | Missing or expired JWT Bearer token in `Authorization` header. | Execute `/api/auth/refresh` or re-authenticate at `/api/auth/login`. |
| **`403 Forbidden`** | Authorization Violation | Insufficient role permissions, or **Separation of Duties violation** (e.g., self-approval). | Ensure user has assigned role; verify user is not attempting self-approval. |
| **`404 Not Found`** | Resource Missing | Non-existent Voucher ID, User ID, Company ID, or Document ID. | Verify UUID coordinates before dispatching request. |
| **`409 Conflict`** | State Conflict | Submitting a voucher that is already `APPROVED`, or unacknowledged duplicate invoice. | Reload voucher status; complete duplicate override workflow. |
| **`422 Unprocessable`** | Schema Validation | Data type mismatch, negative amount, invalid email format, or password length. | Check `details` array in error JSON for specific invalid fields. |
| **`429 Too Many Req`** | Rate Limit Exceeded | Client exceeded Nginx or SlowAPI rate limit threshold. | Check `Retry-After` header and implement exponential backoff. |
| **`500 Internal Error`**| Server Exception | Unhandled internal database or application error. | Note `request_id` from error envelope and contact infrastructure support. |

---

*End of API Specification — MV Payment Approval System v1.0.0 (November 2026)*
