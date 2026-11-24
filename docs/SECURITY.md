# MV Payment Approval System — Security Architecture & Compliance Checklist

```
Document Version : 1.0.0
Release Date     : November 2026
Standard         : OWASP Top 10 (2021), ISO/IEC 27001, SOC 2 Type II
System Name      : MV Payment Approval System
Classification   : Confidential — Enterprise Security Baseline
```

---

## Table of Contents

- [1. Security Architecture Principles](#1-security-architecture-principles)
- [2. Authentication Security Measures](#2-authentication-security-measures)
- [3. Authorization (RBAC) & Separation of Duties](#3-authorization-rbac--separation-of-duties)
- [4. Data Protection & Privacy](#4-data-protection--privacy)
- [5. API Security & Input Sanitation](#5-api-security--input-sanitation)
- [6. File Upload Security & Document Isolation](#6-file-upload-security--document-isolation)
- [7. Session Management & Token Revocation](#7-session-management--token-revocation)
- [8. Cryptographic Standards & Key Management](#8-cryptographic-standards--key-management)
- [9. Immutable Audit Logging & Tamper-Evident Chaining](#9-immutable-audit-logging--tamper-evident-chaining)
- [10. Network Security & Edge Defense](#10-network-security--edge-defense)
- [11. Pre-Production Deployment Security Checklist](#11-pre-production-deployment-security-checklist)
- [12. Vulnerability Disclosure & Incident Response Protocol](#12-vulnerability-disclosure--incident-response-protocol)

---

## 1. Security Architecture Principles

The **MV Payment Approval System** governs corporate fund authorizations, disbursements, and vendor payments. Compromise of transaction integrity, non-repudiation, or authorization barriers directly threatens corporate capital.

The architecture is founded on five zero-trust principles:

```
+-----------------------------------------------------------------------------------+
|                            CORE SECURITY PRINCIPLES                               |
+-----------------------------------------------------------------------------------+
| 1. Zero Trust by Default    : Every request is authenticated, authorized, and     |
|                               encrypted regardless of network perimeter.          |
| 2. Separation of Duties     : Creators cannot approve; Approvers cannot disburse; |
|                               Disbursers cannot authorize.                        |
| 3. Least Privilege          : Micro-scoped roles and credentials with minimum     |
|                               necessary permissions.                              |
| 4. Defense in Depth         : Coordinated defenses across Edge, Web, API, Cache,  |
|                               and Relational Database layers.                     |
| 5. Tamper-Evident Auditing  : Append-only ledger recording all state transitions  |
|                               with cryptographic verification.                    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Authentication Security Measures

Authentication safeguards verify user identity and prevent credential harvesting or brute-force access.

### 2.1 Password Hashing & Storage
- **Algorithm**: `bcrypt` (work factor $\ge 12$) or `Argon2id` ($m=65536, t=3, p=4$).
- **Salt Generation**: Cryptographically secure pseudo-random salt generated per password instance.
- **Plaintext Exposure**: Passwords are never logged, cached, transmitted unencrypted, or stored in plaintext.

### 2.2 Password Complexity Policy
All user accounts must adhere to strict password complexity rules:
- **Minimum Length**: 8 characters (12+ characters enforced for administrative and executive roles).
- **Character Diversity**: Must include at least 1 uppercase letter, 1 lowercase letter, 1 numeric digit, and 1 non-alphanumeric special character (`!@#$%^&*()_+-=[]{}|;:,.<>?`).
- **Dictionary / Common Passwords**: Blocked against common credential leaks and dictionary lists.

### 2.3 Account Lockout Policy
- **Threshold**: 5 consecutive failed login attempts within a 15-minute sliding window.
- **Action**: Immediate account lockout (`is_locked = true`) for **15 minutes**.
- **Audit Logging**: Generates a high-priority `USER_LOCKED` audit record capturing the client IP and browser fingerprint.
- **Administrative Override**: Super Administrators can unlock accounts manually after identity confirmation.

### 2.4 Multi-Factor Authentication (MFA)
- **Protocol**: Time-based One-Time Password (TOTP, RFC 6238).
- **Enforcement**: Mandatory for all users assigned `super_admin` or `director` roles.
- **Recovery Codes**: Single-use cryptographically hashed backup codes provided upon initial MFA enrollment.

### 2.5 Secure Password Reset Flow
- **Token Format**: Signed, cryptographically generated token containing an embedded expiration timestamp (15 minutes).
- **Single-Use Verification**: Token is permanently consumed upon the first password change.
- **Silent Mitigation**: If an unregistered email is submitted, the system returns a generic success response to defeat user enumeration.

---

## 3. Authorization (RBAC) & Separation of Duties

### 3.1 Role-Based Access Control (RBAC) Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                    RBAC ACCESS PERMISSIONS MATRIX                                  |
+----------------------+-----------------+---------------+-------------------+-----------------------+
| Resource / Operation | Super Admin     | Director      | Accountant        | Department Head       |
+----------------------+-----------------+---------------+-------------------+-----------------------+
| Manage Users         | Read / Write    | Read-Only     | No Access         | No Access             |
| System Settings      | Read / Write    | Read-Only     | No Access         | No Access             |
| Approval Rules       | Read / Write    | Read-Only     | No Access         | No Access             |
| Audit Trail Ledger   | Read-Only (All) | Read-Only     | No Access         | No Access             |
| View All Companies   | Full            | Full          | Assigned Only     | Assigned Only         |
| Create Payment Req   | Yes             | No            | Yes               | Yes                   |
| Edit Draft Voucher   | Yes             | No            | Author Only       | Author Only           |
| Approve Voucher      | Override Only   | All Entities  | Prohibited (SoD)  | Departmental Limit    |
| Reject Voucher       | Yes             | Yes           | No Access         | Departmental Limit    |
| Clarification Chat   | Yes             | Yes           | Yes (Author)      | Yes                   |
| Record Bank Payout   | Prohibited (SoD)|Prohibited(SoD)| Full Access       | Prohibited (SoD)      |
| Complete Payout      | Prohibited (SoD)|Prohibited(SoD)| Full Access       | Prohibited (SoD)      |
| View Unmasked Bank   | Yes             | Masked        | Full Access       | Masked                |
| Vendor Management    | Read / Write    | Read-Only     | Bank Detail Edit  | Read-Only             |
| Financial Reports    | Full Analytics  | Full Analytics| Disbursement Rep  | Departmental Only     |
+----------------------+-----------------+---------------+-------------------+-----------------------+
```

### 3.2 Anti-Fraud Separation of Duties (SoD) Controls

The backend explicitly enforces Separation of Duties rules directly in application services and database queries:

1. **Self-Approval Prohibition**:
   ```python
   # Enforced in app/services/approval_service.py
   if payment_request.requested_by_id == current_user.id:
       raise HTTPException(
           status_code=status.HTTP_403_FORBIDDEN,
           detail="Anti-Fraud Violation: You cannot approve a payment request that you created."
       )
   ```
2. **Disbursement-Approval Segregation**:
   - Accounts with approval authority cannot record disbursements or log bank UTRs.
   - Payout execution endpoints (`/api/payments/{id}/record`) reject credentials with `director` or `department_head` roles.
3. **Approval-Disbursement Segregation**:
   - Users with disbursement permissions (`accountant`) cannot approve vouchers.
4. **Dual Authorization Threshold**:
   - Vouchers exceeding executive limits (> ₹10,00,000 / $25,000) require secondary sign-off from a **Director** regardless of departmental pre-approval.

---

## 4. Data Protection & Privacy

### 4.1 Financial & Banking Information Protection
- **Masking in UI/API**: Bank account numbers are masked in general responses (e.g., `••••••••4819`). Unmasked account coordinates are restricted strictly to authorized accountants executing disbursements.
- **Column-Level Encryption**: Sensitive banking coordinates (account numbers, IFSC, SWIFT) and corporate tax IDs (PAN) are stored encrypted in PostgreSQL using AES-256 via `pgcrypto` or application-level cryptographic envelopes.

### 4.2 Error Masking & Sanitization
- In production mode (`ENVIRONMENT=production`), unhandled internal exceptions never leak SQL syntax, stack traces, or server environment paths to API consumers.
- All 500-series errors return a generic message referencing a unique, correlation-traced `request_id`.

### 4.3 Data Minimization
- Passwords, refresh tokens, and credit card numbers are strictly filtered from application log streams.

---

## 5. API Security & Input Sanitation

### 5.1 Input Validation & Schema Enforcement
- All incoming HTTP payloads are validated against strict Pydantic v2 schemas:
  - String inputs are trimmed and checked for maximum length bounds.
  - Financial amounts are strictly validated as positive decimals (`gt=0`) with maximum scale of 2 decimal places.
  - Email addresses are verified using standard RFC 5322 regex.
  - Enumeration fields reject non-whitelisted string values.

### 5.2 SQL Injection Prevention
- Built on **SQLAlchemy 2.0 ORM** with 100% parameterized queries.
- String concatenation or format interpolation for raw SQL queries is strictly prohibited across the codebase.

### 5.3 Cross-Site Scripting (XSS) & Header Defenses
- The React 18 single-page application automatically escapes HTML entities in JSX templates.
- Markdown fields (rejection reasons, clarification messages) are sanitized using DOMPurify before rendering.

### 5.4 Cross-Origin Resource Sharing (CORS)
- CORS headers are locked down to explicit whitelisted origins configured in `CORS_ORIGINS`.
- Wildcard `*` origins are permanently prohibited when `allow_credentials=True` is enabled in production.

---

## 6. File Upload Security & Document Isolation

Uploaded attachments (invoices, receipts, delivery challans) represent a critical attack surface for remote code execution and malware injection.

```
+-----------------------------------------------------------------------------------+
|                        FILE UPLOAD DEFENSE PIPELINE                               |
+-----------------------------------------------------------------------------------+
| [1. Nginx Ceiling: 10MB]                                                          |
|       |                                                                           |
| [2. Extension Whitelist Check: .pdf, .png, .jpg, .jpeg, .xlsx]                    |
|       |                                                                           |
| [3. Magic Byte Signature Verification (python-magic)]                             |
|       |                                                                           |
| [4. Filename Randomization (UUID4)]                                               |
|       |                                                                           |
| [5. Non-Executable Isolated Directory Storage (/app/uploads)]                     |
|       |                                                                           |
| [6. Safe Download Streaming with 'X-Content-Type-Options: nosniff']               |
+-----------------------------------------------------------------------------------+
```

### 6.1 Upload Security Controls
- **Payload Size Ceiling**: Nginx rejects requests exceeding 10 MB (`client_max_body_size 10M;`). FastAPI re-validates file sizes prior to disk streaming.
- **Extension Whitelist**: Only `.pdf`, `.png`, `.jpg`, `.jpeg`, and `.xlsx` are permitted. Dangerous executable extensions (`.exe`, `.sh`, `.php`, `.js`, `.py`, `.bat`, `.cmd`, `.dll`, `.vbs`) are rejected with `HTTP 400`.
- **MIME Magic Byte Validation**: The backend inspects the binary magic bytes using `python-magic` to confirm the true file format matches the reported MIME header, defeating file renaming attacks.
- **Filename Sanitization**: Uploaded files are stripped of original filenames and stored using random UUID4 hashes (e.g., `uploads/documents/7f8a9b0c_3d4e.pdf`). This completely eliminates directory traversal attacks (`../`) and character injection.
- **Non-Executable Storage**: The storage directory is mounted with `noexec` flags and served through application streaming endpoints rather than direct static Nginx paths.

---

## 7. Session Management & Token Revocation

### 7.1 JWT Token Architecture
- **Access Tokens**: Short-lived (30 minutes), signed using `HS256` or `RS256` with high-entropy cryptographic keys.
- **Refresh Tokens**: Long-lived (7 days), stored securely with single-use rotation.

### 7.2 Centralized Session Store (Redis)
- Every login generates an active session entry in Redis (`session:<user_id>:<session_id>`).
- When a user logs out, rotates their password, or is deactivated by an administrator:
  - The specific session key or all user keys are immediately evicted from Redis.
  - The token is placed on an active revocation blacklist until its natural expiration.

### 7.3 Concurrent Session Governance
- Users can review all active browser sessions, IP addresses, and devices in their Profile settings.
- A single-click **Terminate All Other Sessions** invalidates all concurrent logins across remote devices.

---

## 8. Cryptographic Standards & Key Management

### 8.1 Transport Layer Encryption
- Production edge gateway enforces **TLS 1.3** and **TLS 1.2**.
- Insecure legacy protocols (**SSLv2, SSLv3, TLS 1.0, TLS 1.1**) and weak ciphers (RC4, 3DES, MD5) are completely disabled.
- **Forward Secrecy**: Enforced via Elliptic Curve Diffie-Hellman Ephemeral (`ECDHE-ECDSA-AES256-GCM-SHA384`, `ECDHE-RSA-AES256-GCM-SHA384`).

### 8.2 Secret Key Entropy
All application secret keys must be generated using cryptographically secure random sources:
```bash
# Generate 256-bit application secret
openssl rand -hex 32

# Generate dedicated JWT secret
openssl rand -hex 32
```

### 8.3 Secrets Hygiene
- Secrets are **never** committed to version control (`.gitignore` enforces exclusions).
- Production secrets are injected exclusively via environment variables or runtime `.env` files protected with strict permissions:
  ```bash
  chmod 600 /opt/mv-payment-approval/.env
  chown root:root /opt/mv-payment-approval/.env
  ```

---

## 9. Immutable Audit Logging & Tamper-Evident Chaining

To ensure regulatory compliance (SOC 2, ISO 27001, statutory financial audits), every system modification is immutably recorded.

```
+-----------------------------------------------------------------------------------+
|                        CRYPTOGRAPHIC AUDIT CHAINING                               |
+-----------------------------------------------------------------------------------+
| [Block N-1]                                                                       |
| Hash: a891b2c...                                                                  |
|       ^                                                                           |
|       | (incorporated into next hash)                                             |
|       v                                                                           |
| [Block N]                                                                         |
| Event     : REQUEST_APPROVED                                                      |
| User      : Director Vikram Mehta                                                 |
| Timestamp : 2026-11-23T14:32:10Z                                                  |
| Prev Hash : a891b2c...                                                            |
| Current   : SHA256(Block_N_Data + Prev_Hash) = 7f8c9d0...                         |
+-----------------------------------------------------------------------------------+
```

### 9.1 Audit Integrity Safeguards
- **Append-Only Table**: Application database roles are granted `INSERT` and `SELECT` privileges only on `audit_logs`. `UPDATE` and `DELETE` queries are revoked at the PostgreSQL engine level.
- **Captured Metadata**:
  - Exact UTC timestamp with millisecond resolution (`timestamptz`).
  - Acting User ID, Email, and System Role.
  - Client IP address and browser User-Agent header.
  - Event Type and Entity Type / UUID.
  - JSON before/after state diff snapshots.
- **Tamper-Evident Hash Chaining**: Each audit row computes a SHA-256 digest incorporating the previous entry's hash. Any retroactive alteration breaks the cryptographic verification chain.

---

## 10. Network Security & Edge Defense

### 10.1 Nginx Edge Security Headers

The reverse proxy enforces production-grade security headers on every response:

```nginx
# Deny framing to defeat clickjacking
add_header X-Frame-Options "DENY" always;

# Prevent MIME-type confusion sniffing
add_header X-Content-Type-Options "nosniff" always;

# Cross-Site Scripting protection filter
add_header X-XSS-Protection "1; mode=block" always;

# Referrer privacy policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# HTTP Strict Transport Security (HSTS) - 1 year with subdomains and preload
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Restrict browser hardware APIs
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

# Content Security Policy (CSP)
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

### 10.2 Network Isolation & Firewall Rules
- **Internal Docker Network**: The PostgreSQL database (`5432`) and Redis cache (`6379`) are isolated within the internal Docker bridge network (`mv-network`) and do not bind to host interfaces.
- **Host Firewall (UFW)**:
  ```bash
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp   # SSH Administrative Access
  ufw allow 80/tcp   # HTTP (redirects to HTTPS)
  ufw allow 443/tcp  # HTTPS Secure Web Traffic
  ufw enable
  ```

---

## 11. Pre-Production Deployment Security Checklist

Execute this checklist and verify every requirement before deploying the platform to a live environment:

### A. Infrastructure & Host Hardening
- [ ] Operating system packages updated with latest security patches (`apt-get upgrade -y`).
- [ ] SSH root login disabled; SSH key authentication enforced (`PasswordAuthentication no`).
- [ ] Host firewall (UFW) active, permitting only ports `22`, `80`, and `443`.
- [ ] `fail2ban` installed and active on SSH port to prevent brute-force intrusion.
- [ ] Automated NTP time synchronization active (`systemd-timesyncd`).

### B. Secrets & Configuration Hygiene
- [ ] Default `SECRET_KEY` and `JWT_SECRET_KEY` replaced with random 256-bit entropy values.
- [ ] `ENVIRONMENT` set to `production` in `.env`.
- [ ] `DEBUG` mode set to `false`.
- [ ] PostgreSQL and Redis passwords rotated from default placeholders to strong passwords.
- [ ] File permissions on `.env` locked to `chmod 600`.

### C. Database & Persistence Hardening
- [ ] Database migrations (`alembic upgrade head`) applied cleanly without warnings.
- [ ] PostgreSQL and Redis ports (`5432`, `6379`) confirmed inaccessible from external IP addresses.
- [ ] Automated nightly database backup cron job configured and tested with a test restore.
- [ ] Audit log table privileges verified: confirm application user cannot execute `UPDATE` or `DELETE`.

### D. Application & API Validation
- [ ] Initial Super Administrator account provisioned and temporary password changed.
- [ ] Setup endpoint `/api/setup/init` confirmed disabled (`HTTP 403`).
- [ ] Anti-fraud check verified: confirm requester cannot approve their own payment request.
- [ ] Anti-fraud check verified: confirm approver cannot disburse funds or log bank UTRs.
- [ ] File upload test verified: confirm `.exe`, `.sh`, and `.php` files are rejected.
- [ ] File upload test verified: confirm files larger than 10 MB are rejected.
- [ ] Rate limiting verified: rapid requests to `/api/auth/login` trigger `HTTP 429`.

### E. Web & PWA Security
- [ ] SSL/TLS certificate active with an A+ rating on Qualys SSL Labs.
- [ ] All HTTP traffic automatically redirects to HTTPS (301 redirect).
- [ ] Security headers active (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).
- [ ] Service worker (`sw.js`) verified: confirm it does **NOT** cache `/api/v1/approvals` or `/api/v1/payments`.

---

## 12. Vulnerability Disclosure & Incident Response Protocol

### 12.1 Responsible Vulnerability Disclosure
If you identify a security vulnerability in the MV Payment Approval System:
- **Do NOT** disclose the issue publicly or open a public issue.
- Email complete details, reproduction steps, and impact assessment to: `security@yourcompany.com`.
- Encrypt sensitive reports using the enterprise Security PGP Key (`0x7A9B8C1D...`).
- **Response SLAs**:
  - Initial acknowledgement: **Within 24 hours**.
  - Triage and severity assignment: **Within 48 hours**.
  - Remediation and hotfix timeline: **Within 7 business days** (critical vulnerabilities addressed within 24 hours).

---

### 12.2 Security Incident Response Protocol (SIRP)

In the event of an active intrusion, unauthorized access, or data exposure:

```
[1. Identify & Declare] -> [2. Isolate & Contain] -> [3. Eradicate & Patch] -> [4. Recover] -> [5. Audit & Disclose]
```

#### Step 1: Identification & Declaration
1. Triage alert source (audit log anomaly, rate limit spike, user report).
2. Incident Commander declares formal Security Incident and convenes response team.

#### Step 2: Isolation & Containment
1. **Emergency Session Revocation**: Invalidate all active user JWT tokens immediately by flushing the Redis token store:
   ```bash
   docker compose exec redis redis-cli -a <REDIS_PASSWORD> FLUSHDB
   ```
2. **Lock Compromised Accounts**: Mark suspect accounts as locked (`is_locked = true`).
3. **Gateway Maintenance Mode**: If active API exploitation is suspected, temporarily divert traffic to maintenance mode at Nginx:
   ```bash
   systemctl stop nginx
   ```

#### Step 3: Forensic Analysis & Eradication
1. Review PostgreSQL immutable `audit_logs` table for timestamps, IPs, and affected entity records.
2. Inspect Nginx access and error logs (`/var/log/nginx/access.log`).
3. Identify root cause vulnerability and deploy hotfix containers.

#### Step 4: Recovery & Re-opening
1. Rotate all database passwords, JWT signing keys, and external service credentials.
2. Verify system integrity and restart services:
   ```bash
   docker compose up -d --build
   ```
3. Re-enable traffic and monitor error rates.

#### Step 5: Post-Incident Review & Disclosure
1. Conduct post-mortem analysis and compile formal incident report.
2. Notify impacted corporate entities, financial institutions, and regulatory data authorities within statutory windows (72 hours under GDPR / national privacy frameworks).

---

*End of Security Architecture & Compliance Checklist — MV Payment Approval System v1.0.0 (November 2026)*
