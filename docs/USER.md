# MV Payment Approval System — User Guide

```
Document Version : 1.0.0
Release Date     : November 2026
Target Audience  : Accountants, Finance Executives, Department Approvers, Directors, All Users
System Name      : MV Payment Approval System
Classification   : Confidential — Internal Enterprise Documentation
```

---

## Table of Contents

- [1. Introduction & Role-Based Navigation](#1-introduction--role-based-navigation)
- [2. Guide for Accountants & Requesters](#2-guide-for-accountants--requesters)
  - [2.1 Creating a Payment Request (Step-by-Step)](#21-creating-a-payment-request-step-by-step)
  - [2.2 Uploading Supporting Documents](#22-uploading-supporting-documents)
  - [2.3 Duplicate Invoice Detection & Override](#23-duplicate-invoice-detection--override)
  - [2.4 Submitting for Approval](#24-submitting-for-approval)
  - [2.5 Tracking Request Status](#25-tracking-request-status)
  - [2.6 Responding to Clarifications](#26-responding-to-clarifications)
  - [2.7 Recording Payment Details (Disbursement Execution)](#27-recording-payment-details-disbursement-execution)
- [3. Guide for Approvers & Executives](#3-guide-for-approvers--executives)
  - [3.1 Approver Dashboard & Pending Queue](#31-approver-dashboard--pending-queue)
  - [3.2 Reviewing Payment Requests](#32-reviewing-payment-requests)
  - [3.3 Viewing & Validating Supporting Documents](#33-viewing--validating-supporting-documents)
  - [3.4 Approving Payment Requests](#34-approving-payment-requests)
  - [3.5 Rejecting Payment Requests](#35-rejecting-payment-requests)
  - [3.6 Requesting Clarification](#36-requesting-clarification)
- [4. Guide for All Users](#4-guide-for-all-users)
  - [4.1 Login and Password Management](#41-login-and-password-management)
  - [4.2 In-App Notifications & Alerts](#42-in-app-notifications--alerts)
  - [4.3 User Profile & Security Settings](#43-user-profile--security-settings)
  - [4.4 PWA Installation (Android, iOS, Desktop)](#44-pwa-installation-android-ios-desktop)
  - [4.5 Offline Policy & Security Boundaries](#45-offline-policy--security-boundaries)

---

## 1. Introduction & Role-Based Navigation

The **MV Payment Approval System** digitizes enterprise payment requests, invoice verifications, multi-tier management authorizations, and banking disbursements. Depending on your assigned corporate role, the system presents tailored navigation menus and operational views:

```
+-----------------------------------------------------------------------------------+
|                            NAVIGATION PER USER ROLE                               |
+----------------------+------------------------------------------------------------+
| Role                 | Accessible Modules & Workflow Functions                    |
+----------------------+------------------------------------------------------------+
| **Accountant /**     | - Dashboard: Cash outflow KPIs, pending payouts            |
| **Finance Exec**     | - New Payment Request: Initiate vouchers                   |
|                      | - My Requests: Track submitted requests                    |
|                      | - Clarifications: Queries awaiting response                |
|                      | - Payment Processing: Disburse funds & record bank UTR     |
|                      | - Completed Payments: History of disbursed vouchers        |
|                      | - Vendors: View vendor bank coordinates                    |
+----------------------+------------------------------------------------------------+
| **Approver /**       | - Approver Dashboard: Vouchers awaiting authorization      |
| **Department Head**  | - Pending Approvals: Departmental review queue             |
|                      | - Approval History: Decisions taken                        |
|                      | - Clarification Threads: Inquiries with requesters         |
|                      | - Departmental Reports: Budget tracking                    |
+----------------------+------------------------------------------------------------+
| **Director /**       | - Executive Dashboard: Enterprise-wide financial overview  |
| **Executive**        | - High-Value Approvals: Tier 3 vouchers (> ₹10,00,000)     |
|                      | - Multi-Company Approvals: Cross-entity sign-offs          |
|                      | - Financial Analytics & Spend Reports                      |
+----------------------+------------------------------------------------------------+
| **Super Admin**      | - Full access to all modules, settings, users, audit logs  |
+----------------------+------------------------------------------------------------+
```

---

## 2. Guide for Accountants & Requesters

As an Accountant or authorized Department Requester, your primary duties include generating payment requests from vendor invoices, attaching audit documentation, tracking approval statuses, and recording final banking disbursements.

### 2.1 Creating a Payment Request (Step-by-Step)

Follow these steps to initiate a payment voucher:

```
[Step 1: General Info] -> [Step 2: Amount & Tax] -> [Step 3: Attachments] -> [Step 4: Review & Submit]
```

#### Step 1: Navigate to the Request Form
1. Click **+ New Request** in the sidebar navigation or from the top navigation bar.
2. Direct URL: `/payments/new` or `/accountant/create-request`.

#### Step 2: Operating Entity & Cost Center
1. **Operating Company**: Select the legal entity responsible for the expense from the dropdown (e.g., `MV Agro Industries Ltd`).
2. **Originating Department**: Select your department / cost center (e.g., `Information Technology`).

#### Step 3: Vendor & Invoice Details
1. **Target Vendor**: Select the approved payee from the searchable dropdown.
   - Once selected, the vendor's registered bank name, account number, and IFSC code are automatically displayed for verification.
2. **Expense Category**: Select the appropriate expenditure head:
   - `RAW_MATERIALS`, `UTILITIES`, `RENT`, `OFFICE_SUPPLIES`, `CONSULTING`, `IT_SOFTWARE`, `LOGISTICS`, `MAINTENANCE`, `CAPITAL_EXPENDITURE`, or `OTHER`.
3. **Expense Subcategory** (Optional): Add specific sub-classifications (e.g., `Cloud Hosting`).
4. **Invoice Number**: Input the exact invoice number provided by the supplier (e.g., `INV-2026-9921`).
5. **Invoice Date**: Enter the date printed on the vendor invoice.
6. **Due Date**: Enter the payment deadline agreed upon in purchase terms.

#### Step 4: Monetary Breakdown
1. **Base Amount**: Enter the taxable value excluding taxes (e.g., `100000.00`).
2. **GST / Tax Amount**: Enter the tax component (e.g., `18000.00`).
3. **Total Payout Amount**: The system automatically computes and displays:
   $$\text{Total Amount} = \text{Base Amount} + \text{GST Amount} = 1,18,000.00$$
4. **Preferred Payment Mode**: Select `NEFT`, `RTGS`, `IMPS`, `UPI`, or `CHEQUE`.
5. **Priority Level**:
   - `NORMAL`: Standard vendor credit terms (processed within SLA).
   - `HIGH`: Priority vendor or prompt discount incentive.
   - `URGENT`: Critical supply disruption, statutory penalty risk, or emergency repairs.

#### Step 5: Purpose and Business Justification
In the **Payment Purpose** field, provide a comprehensive description of the goods or services procured, project codes, and justification.

---

### 2.2 Uploading Supporting Documents

Every payment request must be backed by verifiable documentary evidence.

```
+-----------------------------------------------------------------------------------+
|                         DOCUMENT UPLOAD SPECIFICATIONS                            |
+-----------------------------------------------------------------------------------+
| Maximum File Size      : 10 MB per attachment                                     |
| Allowed Formats        : PDF (.pdf), PNG (.png), JPEG (.jpg, .jpeg), Excel (.xlsx)|
| Mandatory Files        : 1. Vendor Tax Invoice (PDF or image)                     |
| Optional / Supporting  : 2. Purchase Order (PO) or Contract Copy                  |
|                          3. Goods Received Note (GRN) or Work Completion Cert     |
|                          4. Quotations / Rate Comparative Statement               |
+-----------------------------------------------------------------------------------+
```

#### Upload Procedure:
1. In the **Supporting Documents** section of the form, drag and drop files into the designated drop zone, or click **Browse Files**.
2. As files upload:
   - The system computes file size and validates the binary magic bytes to guarantee security.
   - A green checkmark appears once successfully staged.
3. Review attached documents in the file queue. To remove an accidental upload, click the **Trash** icon next to the file name.

---

### 2.3 Duplicate Invoice Detection & Override

To eliminate duplicate payments, the system performs a real-time database query comparing the **Vendor ID** and **Invoice Number**.

```
+-----------------------------------------------------------------------------------+
|                     [!] POTENTIAL DUPLICATE INVOICE DETECTED                      |
+-----------------------------------------------------------------------------------+
| A payment request with Invoice # 'INV-2026-9921' under 'Tata Steel Ltd' was       |
| already submitted on 2026-10-14 under Request # REQ-2026-0412 (Status: PAID).     |
|                                                                                   |
| [ ] I confirm this is a legitimate recurring invoice or revised milestone bill.   |
| Justification: [ Supplier issued revised debit note with revised GST credit... ]  |
+-----------------------------------------------------------------------------------+
```

- If a matching record is found:
  1. A warning modal is triggered immediately.
  2. The system prevents direct submission until the user marks the **Duplicate Override** checkbox.
  3. You must provide a **Duplicate Override Reason** explaining why this voucher is legitimate (e.g., partial milestone, credit-debit note adjustment).
  4. This justification is permanently recorded in the audit log and highlighted to the approver.

---

### 2.4 Submitting for Approval

Once all fields and documents are verified:
- **Save as Draft**: Click **Save Draft** if you need to gather additional documents. Drafts remain under your account (`DRAFT` status) and are not visible to approvers.
- **Submit for Approval**: Click **Submit for Approval**.
  - The status advances to `PENDING_APPROVAL`.
  - The rule engine evaluates the company and total amount, automatically routing the voucher to the appropriate **Department Head** or **Director**.
  - The assigned approver receives an instant in-app notification and email alert.

---

### 2.5 Tracking Request Status

Monitor your submitted vouchers via **My Requests** (`/my-requests`).

```
+-----------------------------------------------------------------------------------+
|                               PAYMENT LIFECYCLE                                   |
+-----------------------------------------------------------------------------------+
|  [DRAFT]  --->  [PENDING APPROVAL]  <=========>  [CLARIFICATION REQUIRED]         |
|                         |                                                         |
|             +-----------+-----------+                                             |
|             v                       v                                             |
|        [APPROVED]              [REJECTED]                                         |
|             |                                                                     |
|             v                                                                     |
|   [PAYMENT PROCESSING]                                                            |
|             |                                                                     |
|             v                                                                     |
|      [PAID / COMPLETED]                                                           |
+-----------------------------------------------------------------------------------+
```

#### Status Dictionary:

| Status Badge | Meaning | Next Action Required |
| :--- | :--- | :--- |
| `DRAFT` | Staged by requester, not yet submitted. | Edit and submit for approval. |
| `PENDING_APPROVAL` | Under review by assigned approver. | No action; waiting for approver. |
| `CLARIFICATION_REQUIRED` | Approver has posted an inquiry. | Requester must reply and provide info. |
| `APPROVED` | Fully authorized by management. | Queued for payment disbursement. |
| `REJECTED` | Declined by approver. | Voucher is archived; read rejection reason. |
| `PAYMENT_PROCESSING` | Accountant is executing bank transfer. | Bank processing in progress. |
| `PAID` / `COMPLETED` | Funds disbursed and bank UTR logged. | Transaction complete. |
| `CANCELLED` | Cancelled by requester or admin. | Closed. |

---

### 2.6 Responding to Clarifications

When an approver requires additional context or corrected documents:
1. You will receive an immediate notification: *"Clarification requested for Voucher # REQ-2026-0891"*.
2. Navigate to **Pending Clarification** (`/accountant/clarifications`) or click the notification.
3. Open the voucher detail view to see the **Clarification Dialogue Thread**.
4. Read the approver's query (e.g., *"Please provide the signed Goods Received Note before sign-off."*).
5. In the reply box:
   - Type your detailed response.
   - Upload any requested replacement or supplementary attachments.
6. Click **Send Response**.
7. The voucher status automatically returns to `PENDING_APPROVAL`, returning it to the approver's active queue.

---

### 2.7 Recording Payment Details (Disbursement Execution)

Once a voucher reaches `APPROVED` status, it moves to the finance disbursement queue.

#### Step-by-Step Payment Recording:
1. Navigate to **Finance** > **Payment Processing** (`/accountant/processing`).
2. The table lists all approved vouchers awaiting disbursement, sorted by due date and priority.
3. Click **Process Payment** on the target request.
4. Execute the financial transfer through your corporate banking portal (e.g., HDFC Corporate NetBanking, SBI Corporate portal) using the verified vendor bank coordinates shown on screen.
5. In the **Record Disbursement** dialog within MV Payment Approval:
   - **Payment Date**: Select the date and time of the transfer.
   - **Actual Disbursed Amount**: Confirm net payout (accounting for any TDS deductions).
   - **Payment Mode**: Confirm actual disbursement channel (`NEFT`, `RTGS`, `IMPS`, `UPI`, `CHEQUE`).
   - **Disbursing Bank Account**: Select the company bank account from which funds were debited.
   - **Bank UTR Number**: Enter the 16–22 character **Unique Transaction Reference (UTR)** from your bank debit advice (e.g., `HDFCN26328192841`).
   - **Transaction ID / Cheque #**: Input banking transaction reference or cheque serial number.
   - **Upload Payment Advice**: Attach the bank transaction confirmation slip or PDF payment advice.
   - **Remarks**: Optional accountant notes.
6. Click **Confirm & Complete Disbursement**.
7. The voucher status updates to `PAID`, notifications are dispatched to the requester, and the transaction is permanently sealed in the audit ledger.

---

## 3. Guide for Approvers & Executives

As an Approver (Department Head, Finance Manager, or Director), you are responsible for reviewing payment authenticity, enforcing budgetary compliance, and authorizing corporate expenditures.

### 3.1 Approver Dashboard & Pending Queue

Access your review queue via **Approver Dashboard** (`/approver/dashboard`) or **Pending Approvals** (`/approver/pending`).

```
+-----------------------------------------------------------------------------------+
|                               APPROVER DASHBOARD                                  |
+-----------------------------------------------------------------------------------+
|  [Pending Approvals]    [Total Value at Risk]    [Urgent Vouchers]    [SLA Alerts]|
|         12                    ₹24,80,000                 2                  0     |
+-----------------------------------------------------------------------------------+
```

#### Queue Priority Indicators:
- **Red "URGENT" Badge**: Time-critical voucher requiring review within 4 hours.
- **Due Date Warning**: Amber highlight if invoice due date is within 48 hours.
- **Duplicate Override Alert**: Prominent notice if the voucher bypassed a duplicate invoice check.

---

### 3.2 Reviewing Payment Requests

Click on any voucher row to open the **Approval Detail View** (`/approver/{id}`).

#### Critical Review Checklist:
1. **Business Justification**: Is the payment purpose clear, necessary, and aligned with company activities?
2. **Entity Allocation**: Is the voucher charged to the correct operating company and department budget?
3. **Vendor Identity**: Is the payee an authorized supplier? Does the vendor bank account match previous legitimate payments?
4. **Invoice Authenticity**: Does the invoice date precede the payment request? Are GST and base amounts calculated correctly?
5. **Duplicate Check Review**: If an override warning is present, scrutinize the justification text.

---

### 3.3 Viewing & Validating Supporting Documents

1. In the **Attached Documents** card, click on any file:
   - **In-App Preview**: Click the **Eye** icon to view PDF invoices or images directly in your browser without downloading.
   - **Download**: Click the **Download** icon to save high-resolution copies for local verification.
2. Cross-reference the uploaded invoice total against the system's requested payout amount.

---

### 3.4 Approving Payment Requests

When satisfied that the request is valid and compliant:

```
+-----------------------------------------------------------------------------------+
|                            CONFIRM PAYMENT APPROVAL                               |
+-----------------------------------------------------------------------------------+
| Request Number : REQ-2026-0891                                                    |
| Vendor         : Tata Steel Limited                                               |
| Amount         : ₹4,50,000.00                                                     |
|                                                                                   |
| Approved Amount: [ 450000.00 ]  (Modify if approving adjusted/partial payout)     |
| Remarks        : [ Approved as per Q3 Capex Budget Allocation #442...        ]    |
|                                                                                   |
|                        [ Cancel ]       [ Confirm Approval ]                      |
+-----------------------------------------------------------------------------------+
```

1. Click the green **Approve Request** button.
2. In the confirmation dialog:
   - **Approved Amount**: Defaults to the full amount. If approving a partial payout, adjust this numeric field.
   - **Approver Remarks**: Enter optional sign-off comments or budget codes.
3. Click **Confirm Approval**.
4. The system cryptographically logs your user ID, timestamp, IP address, and browser fingerprint in the immutable audit log.
5. Next step:
   - If the voucher amount falls within your tier limit, it advances to `APPROVED` and moves to the Accountant queue.
   - If the voucher exceeds your tier ceiling, it automatically escalates to the **Director Tier** for secondary authorization.

---

### 3.5 Rejecting Payment Requests

If an expenditure is unauthorized, inaccurate, or non-compliant:
1. Click the red **Reject Request** button.
2. In the rejection modal:
   - **Rejection Reason**: You **must** provide a detailed justification explaining why the voucher is being declined (e.g., *"Invoice rates exceed MSA contract terms by 12%. Please renegotiate with vendor."*).
3. Click **Confirm Rejection**.
4. The voucher is permanently transitioned to `REJECTED`. The requester receives an immediate notification with your feedback.

> [!NOTE]
> Rejected vouchers cannot be edited or re-submitted. If an invoice needs correction, the requester must initiate a new payment request.

---

### 3.6 Requesting Clarification

If you need additional documentation or clarification before making a decision, do **not** reject the voucher. Use the clarification feature:
1. Click the amber **Request Clarification** button.
2. Enter your specific question or request (e.g., *"Please attach the third-party delivery challan confirming site arrival at Plant 2."*).
3. Click **Send Inquiry**.
4. The voucher moves to `CLARIFICATION_REQUIRED`. It is temporarily paused in your queue until the requester replies.

---

## 4. Guide for All Users

This section covers general platform capabilities accessible to all authenticated accounts.

### 4.1 Login and Password Management

#### Logging In:
1. Navigate to `https://<your-domain>/login`.
2. Enter your corporate email and password.
3. (Optional) Check **Remember Me** to maintain your session across browser restarts.
4. Click **Sign In**.

#### Password Security Rules:
- Minimum 8 characters (12+ recommended).
- Must include at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special symbol (`!@#$%^&*`).
- Passwords expire every 90 days if enforced by corporate policy.

#### Forgot Password Recovery:
1. On the login screen, click **Forgot your password?**.
2. Enter your registered email address and click **Send Reset Link**.
3. Check your email for a secure reset link (valid for 15 minutes).
4. Click the link, input your new password twice, and confirm.

> [!WARNING]
> If you enter an incorrect password 5 consecutive times, your account will be temporarily locked for 15 minutes to prevent brute-force attacks. Wait 15 minutes or contact your System Administrator to unlock your account immediately.

---

### 4.2 In-App Notifications & Alerts

The real-time notification engine keeps you informed of critical events without refreshing the page.

```
+-----------------------------------------------------------------------------------+
|                                NOTIFICATIONS (3)                                  |
+-----------------------------------------------------------------------------------+
| [*] Payment Approved: REQ-2026-0891 (Tata Steel) has been approved by Director.   |
|     10 minutes ago • Click to view voucher                                        |
|                                                                                   |
| [*] Clarification Needed: Director Vikram Mehta requested info on REQ-2026-0895.  |
|     1 hour ago • Click to open thread                                             |
|                                                                                   |
| [*] Payment Disbursed: Payout executed for REQ-2026-0880 via UTR HDFCN881920.     |
|     3 hours ago • Click to view advice                                            |
|                                                                                   |
|                     [ Mark All as Read ]       [ View All ]                       |
+-----------------------------------------------------------------------------------+
```

- **Bell Icon**: Located in the top-right header with an unread badge counter.
- Click any notification item to jump directly to the relevant payment request.
- Click **Mark All as Read** to clear unread badges.

---

### 4.3 User Profile & Security Settings

Click your user avatar in the top-right corner and select **Profile Settings** (`/profile`).

- **Personal Information**: Update your first name, last name, and contact telephone number.
- **Change Password**: Input your current password followed by your new password.
- **Session History**: View active browser sessions, operating systems, and IP addresses currently logged into your account.
- **Revoke Other Sessions**: Terminate all other active logins with a single click.

---

### 4.4 PWA Installation (Android, iOS, Desktop)

The MV Payment Approval System is built as an enterprise **Progressive Web App (PWA)**. Installing it provides a native application experience: fast startup, dedicated home screen icon, fullscreen view without browser URL bars, and smooth performance.

```
+-----------------------------------------------------------------------------------+
|                             PWA INSTALLATION MATRIX                               |
+--------------------+---------------------+----------------------------------------+
| Operating System   | Recommended Browser | Installation Method                    |
+--------------------+---------------------+----------------------------------------+
| **Android**        | Google Chrome       | In-browser Install Prompt or Menu      |
| **iOS / iPadOS**   | Apple Safari        | Safari Share Sheet > Add to Home Screen|
| **Windows / macOS**| Google Chrome, Edge | Address Bar Install Icon               |
+--------------------+---------------------+----------------------------------------+
```

---

#### Step-by-Step Installation for Android (Google Chrome)

```
[1. Open Chrome] -> [2. Tap More Menu (⋮)] -> [3. Tap "Install App"] -> [4. Tap "Install"]
```

1. Open **Google Chrome** on your Android device.
2. Navigate to your corporate payment approval URL: `https://<your-domain>`.
3. An installation banner may appear at the bottom of the screen: tap **Install MV Approval**.
4. If no banner appears:
   - Tap the **Three Dots Menu** (`⋮`) in the top-right corner of Chrome.
   - Select **Install app** (or **Add to Home screen**).
   - In the confirmation pop-up, confirm the name **MV Approval** and tap **Install**.
5. The application will be downloaded and added to your phone's Home Screen and App Drawer.
6. Tap the **MV Approval** icon to launch the app in standalone native mode.

---

#### Step-by-Step Installation for iOS & iPadOS (Apple Safari)

> [!IMPORTANT]
> On iOS and iPadOS, Apple requires PWA installation to be performed through **Apple Safari**. Chrome or Firefox on iOS cannot install PWAs to the home screen.

```
[1. Open Safari] -> [2. Tap Share Icon (↑)] -> [3. Tap "Add to Home Screen"] -> [4. Tap "Add"]
```

1. Open **Safari** on your iPhone or iPad.
2. Navigate to the application URL: `https://<your-domain>`.
3. Log in to your account.
4. Tap the **Share** button at the bottom of the Safari screen (the square icon with an arrow pointing upwards):

   $$\boxed{\uparrow}$$

5. Scroll down through the share options and tap **Add to Home Screen** (accompanied by a `[+]` icon).
6. In the top-right corner of the confirmation screen, verify the application title **MV Approval** and tap **Add**.
7. The **MV Approval** monogram icon will appear on your iOS home screen.
8. Tap the icon to launch the platform in standalone mode with full screen estate and no Safari address bar.

---

#### Step-by-Step Installation for Desktop (Windows & macOS)

1. Open **Google Chrome** or **Microsoft Edge** on your workstation.
2. Navigate to the application portal: `https://<your-domain>`.
3. In the address bar (right side), look for the **Install App** icon:
   - In Chrome: An icon resembling a computer monitor with a small down arrow.
   - In Edge: An icon resembling three overlapping squares with a plus sign.
4. Click the icon, then click **Install** in the confirmation dialog.
5. The app immediately opens in its own desktop window and can be pinned to your Windows Taskbar or macOS Dock.

---

### 4.5 Offline Policy & Security Boundaries

Because the MV Payment Approval System handles real-time financial authorizations and treasury funds, strict security boundaries apply when your device is offline:

- **Cached App Shell**: When offline, the app shell, branding, and navigation will load instantly.
- **Financial Mutability Guard**: **Financial actions (approving, rejecting, creating vouchers, or disbursing funds) are strictly disabled while offline.** The system will never cache pending approvals locally to prevent out-of-order execution, replay attacks, or conflicting decisions.
- **Offline Screen**: If your internet connection drops, the app displays a branded **Offline Notice** (`offline.html`) with an automated network polling indicator. As soon as your internet connectivity is restored, the application resumes automatically without losing your session.

---

*End of User Guide — MV Payment Approval System v1.0.0 (November 2026)*
