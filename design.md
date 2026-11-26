# MV Greentech - UI/UX Design System Specification

> **Brand Identity:** MV Greentech Global Pvt. Ltd.  
> **Product:** Enterprise Payment Approval & Financial Authorization System  
> **Design Philosophy:** Precision, Financial Integrity, High Legibility, Green Corporate Trust  
> **Status:** Production Standard (v2.1)

---

## 1. Brand Philosophy & Visual Principles

The MV Greentech design system is tailored specifically for high-stakes enterprise financial operations. Every interface element adheres to four core design principles:

1. **Absolute Clarity & Financial Precision:** Numbers, decimal values, currency indicators (`₹`), and transaction references (UTRs) must never wrap unpredictably, truncate silently, or cause visual ambiguity.
2. **Predictable Action Hierarchy:** Critical approval and disbursement actions (`Approve`, `Disburse`, `Reject`) use universally recognized semantic color coding with deliberate confirmation modals to prevent accidental clicks.
3. **Enterprise Ergonomics (Desktop & Mobile PWA):** Seamless responsiveness across widescreen accountant monitors (1920x1080) and executive smartphones (PWA standalone mode).
4. **Corporate Identity Alignment:** Built around the signature **MV Greentech Forest Green (`#0D5C3A`)**, symbolizing sustainability, stability, and corporate growth.

---

## 2. Color Palette & Design Tokens

### 2.1 Primary Brand Palette

| Token Name | Hex Code | RGB | HSL | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`brand-primary`** | `#0D5C3A` | `13, 92, 58` | `154°, 75%, 21%` | Primary buttons, active nav states, brand logo background |
| **`brand-primary-hover`** | `#09442A` | `9, 68, 42` | `154°, 77%, 15%` | Button hover and pressed states |
| **`brand-primary-light`** | `#E8F5EE` | `232, 245, 238` | `148°, 43%, 94%` | Active sidebar item background, subtle brand accents |
| **`brand-accent`** | `#10B981` | `16, 185, 129` | `160°, 84%, 39%` | Positive financial growth, paid status badges, checkmarks |

### 2.2 Semantic Financial Status Colors

| Status | Badge Background | Badge Text | Icon Color | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **`PAID`** | `#ECFDF5` (`emerald-50`) | `#065F46` (`emerald-800`) | `#10B981` | Fully disbursed with verified UTR |
| **`APPROVED`** | `#F0FDF4` (`green-50`) | `#166534` (`green-800`) | `#22C55E` | Authorized by Director, queued for finance |
| **`PENDING`** | `#FFFBEB` (`amber-50`) | `#92400E` (`amber-800`) | `#F59E0B` | Awaiting executive review |
| **`CLARIFICATION`** | `#F0F9FF` (`sky-50`) | `#075985` (`sky-800`) | `#0284C7` | Queries raised by Approver to Requester |
| **`REJECTED`** | `#FFF1F2` (`rose-50`) | `#9F1239` (`rose-800`) | `#F43F5E` | Declined with recorded reason |
| **`DRAFT`** | `#F8FAFC` (`slate-50`) | `#475569` (`slate-600`) | `#94A3B8` | Unsubmitted voucher draft |

### 2.3 Neutral & Dark Mode Surfaces

```
Light Mode:
+-----------------------------------------------------------------------+
| Window Background: #F8FAFC (slate-50)                                 |
|   +-----------------------------------------------------------------+ |
|   | Card Surface: #FFFFFF (white)                                   | |
|   | Border: #E2E8F0 (slate-200)                                     | |
|   | Text Primary: #0F172A (slate-900) | Secondary: #64748B (slate-500) | |
|   +-----------------------------------------------------------------+ |
+-----------------------------------------------------------------------+

Dark Mode:
+-----------------------------------------------------------------------+
| Window Background: #0B1320 (deep dark navy)                           |
|   +-----------------------------------------------------------------+ |
|   | Card Surface: #131E30 (slate dark card)                         | |
|   | Border: #1E293B (slate-800)                                     | |
|   | Text Primary: #F8FAFC (slate-50)  | Secondary: #94A3B8 (slate-400) | |
|   +-----------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

---

## 3. Typography Hierarchy

The system incorporates two specialized typefaces loaded from Google Fonts:
1. **Inter:** High-legibility grotesque sans-serif for UI labels, titles, forms, navigation, and dialogs.
2. **JetBrains Mono:** Monospaced typeface for all numerical financial representations (INR currency, invoice numbers, bank account numbers, IFSC codes, UTR identifiers).

```css
/* Typography Scale */
Display 1:   32px / 2.0rem  - SemiBold 600 - Inter (Dashboard greetings, Hero metrics)
Heading 1:   24px / 1.5rem  - SemiBold 600 - Inter (Page headers, Modal titles)
Heading 2:   20px / 1.25rem - Medium 500   - Inter (Section headers, Card titles)
Heading 3:   16px / 1.0rem  - SemiBold 600 - Inter (Table column headers, Group titles)
Body Main:   14px / 0.875rem- Regular 400  - Inter (Table cell values, Form labels)
Body Meta:   12px / 0.75rem - Regular 400  - Inter (Timestamps, Secondary descriptions)
Mono Value:  14px / 0.875rem- Medium 500   - JetBrains Mono (₹ 4,50,000.00, UTR-892102)
```

---

## 4. Layout & Navigation Architecture

### 4.1 Global Layout Grid
- **Desktop Grid (>= 1024px):**
  - **Sidebar:** Fixed width `260px`, collapsible to `72px` icon-only mode.
  - **Header:** Height `64px`, sticky top with brand monogram, global search, notification bell with unread badge, and user profile avatar with role badge.
  - **Main Canvas:** Max width `1440px` centered with dynamic padding (`px-4 sm:px-6 lg:px-8`).
- **Tablet & Mobile Grid (< 1024px):**
  - **Header:** Sticky top with hamburger trigger, centered MV Greentech logo, quick-actions menu.
  - **Drawer:** Slide-over navigation drawer from left (`w-80`).
  - **Bottom Navigation Bar:** Quick thumb access to Home, New Request, Approvals, and Profile.

### 4.2 Sidebar Menu Structure by Role

```
+--------------------------------------------------------+
| [M] MV GREENTECH - PAYMENT SYSTEM                      |
+--------------------------------------------------------+
|                                                        |
|  MAIN WORKSPACE                                        |
|  * Dashboard                   (All Roles)             |
|  * Payment Requests            (Requester, Admin)      |
|  * Create Payment Request (+)  (Requester, Admin)      |
|                                                        |
|  APPROVAL WORKFLOW                                     |
|  * Pending Approvals           (Director, Approver)    |
|  * Approval History            (Director, Approver)    |
|                                                        |
|  DISBURSEMENT & QUEUE                                  |
|  * Payment Processing / Queue  (Accountant, Admin)     |
|  * Completed Payments          (Accountant, Admin)     |
|                                                        |
|  DIRECTORY & VENDORS                                   |
|  * Vendors Management          (All Roles)             |
|  * Payment Tracking            (All Roles)             |
|                                                        |
|  ADMINISTRATION                                        |
|  * User Management             (Super Admin only)      |
|  * Company Management          (Super Admin only)      |
|  * Department Management       (Super Admin only)      |
|  * Audit Logs                  (Super Admin only)      |
|  * System Settings             (Super Admin only)      |
|                                                        |
+--------------------------------------------------------+
```

---

## 5. Form Design & Interactive UI Patterns

### 5.1 Dual-Path Payment Form (Vendor vs. Employee Reimbursement)
The **Create Payment Request** form dynamically transforms depending on the selected payee type:

```
[ Form Header: New Payment Voucher ]
|
+--- [ Recipient Type Radio ] -------------------------------+
|    ( ) External Vendor Invoice    (*) Employee Reimbursement |
+------------------------------------------------------------+
|
+--- IF Employee Reimbursement Selected: --------------------+
|    - Vendor Dropdown is automatically HIDDEN                |
|    - Payee Name defaults to logged-in user                 |
|    - Beneficiary Bank Name & Account Number (auto-filled)  |
|    - Beneficiary IFSC / UPI ID for instant settlement      |
|    - Expense Category: Travel / Meals / Client / Emergency  |
|    - Bill / Ticket Receipts drag-and-drop zone             |
+------------------------------------------------------------+
|
+--- IF External Vendor Selected: ---------------------------+
|    - Searchable Vendor Selector with "Add New Vendor" modal |
|    - Auto-fills Vendor GSTIN, PAN, and Bank Coordinates    |
|    - Invoice Number, Invoice Date, Due Date fields         |
|    - Tax / TDS Deductions & Gross Amount calculation       |
+------------------------------------------------------------+
```

### 5.2 Confirmation & Destruction Modals
- **Dangerous Actions (User Deletion, Voucher Cancellation):**
  - Uses double-confirmation with warning badge (`Rose-600`).
  - Requires explicit confirmation button click with clear label: `"Yes, Permanently Delete User"`.
- **Approval Actions:**
  - One-click approval with optional comment field.
  - Rejection requires mandatory comments explaining the reason for non-approval.
- **Disbursement Modal (Accountant):**
  - Displays payee bank details in highlighted contrast container.
  - Requires entering bank UTR / Reference ID before `"Confirm Payment"` button enables.

---

## 6. PWA & Native Mobile Experience

1. **Manifest Configuration:**
   - **Name:** `MV Greentech - Payment Approval System`
   - **Short Name:** `MV Greentech`
   - **Theme Color:** `#0D5C3A`
   - **Background Color:** `#FFFFFF`
   - **Display:** `standalone`
2. **Icon Assets:**
   - Pre-rendered crisp 192x192 and 512x512 PNG and SVG vectors with white padded rounded-rect backgrounds.
   - Maskable icon compatibility for Android adaptive icon shapes.
3. **Offline Resilience:**
   - Dedicated branded offline fallback screen (`/offline.html`) when network connectivity drops.
   - Financial mutation actions display `"Offline: Actions will sync once network is restored"` notice.
