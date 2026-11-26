# MV Greentech - Engineering & Operational Rules (Rulebook)

> **Document Type:** Mandatory Engineering Standards & Code Governance  
> **Applies to:** Frontend, Backend, Database, Infrastructure, CI/CD  
> **Enforcement:** Automated Linting, Type Checks, Code Reviews, Production Pre-commit Hooks

---

## 1. The Five Golden Commandments

1. **Zero Mock Data in Production (Absolute Rule):**  
   Under no circumstances may hardcoded fallback mock arrays (e.g. `mockUsers`, `mockCompanies`, `initialVendors`, `FALLBACK_PENDING_REQUESTS`) be reintroduced to components or stores. The UI must render 100% real PostgreSQL database records. If a dataset is empty, render the designated empty state component (`<EmptyState />`).
2. **Defensive API Data Normalization:**  
   Always parse list endpoints through the `normalizePaginated<T>()` utility or ensure safe array fallbacks (`(departments || []).map(...)`). An API change must never cause an unhandled client crash (`.map is not a function`).
3. **Financial Immutability & Audit Trail:**  
   Every state change on a payment request (`SUBMIT`, `APPROVE`, `REJECT`, `CLARIFY`, `DISBURSE`, `CANCEL`) and administrative mutation (`USER_DELETE`, `COMPANY_EDIT`) must write an immutable entry to `audit_logs` capturing user ID, timestamp, IP address, and payload delta.
4. **Strict Type Safety & Zero Build Warnings:**  
   Code must pass `npm run build` (TypeScript compiler `tsc` + Vite) and Python type checking with zero compile errors before pushing to the `main` branch.
5. **Brand Identity Consistency:**  
   All interfaces, PWA manifests, favicons, dialogs, and emails must adhere strictly to the **MV Greentech Forest Green (`#0D5C3A`)** brand standard. Never revert to generic blue, purple, or indigo templates.

---

## 2. Frontend Development Standards (React + TypeScript)

### 2.1 Component Structure & Styling
- **Functional Components:** All components must be written as React Functional Components (`React.FC<Props>`) with explicitly typed props interfaces.
- **Tailwind Utility Classes Only:** Avoid inline styles (`style={{ ... }}`). Use Tailwind CSS utility classes and design tokens defined in `tailwind.config.js`.
- **Dark Mode Compatibility:** Every container, card, border, and text element must include appropriate dark variants (e.g. `bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border text-slate-900 dark:text-white`).

### 2.2 State Management Rules
- **Authentication & User Identity:** Managed exclusively via Zustand in `@/store/authStore.ts`.
- **Server Data Caching:** Use TanStack React Query (`useQuery`, `useMutation`).
  - Queries must define explicit `queryKey` tuples (e.g. `['payment-requests', id]`).
  - Mutations must invalidate affected query keys upon success (`queryClient.invalidateQueries({ queryKey: [...] })`).
- **Form State & Sanitization:** Use `react-hook-form` with `zod` schema resolvers. Never bind unrestrained raw input fields without sanitization.

### 2.3 Defensive Rendering Pattern
```typescript
// MANDATORY PATTERN for rendering lists:
const items = useMemo(() => {
  return normalizePaginated<Vendor>(rawVendorsData).items || [];
}, [rawVendorsData]);

return (
  <div>
    {isLoading ? (
      <LoadingSpinner />
    ) : items.length === 0 ? (
      <EmptyState title="No vendors found" />
    ) : (
      items.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)
    )}
  </div>
);
```

---

## 3. Backend Development Standards (FastAPI + Python)

### 3.1 Asynchronous Python & SQLAlchemy 2.0
- **Pure Async Operations:** All database transactions must use asynchronous sessions (`async with AsyncSessionLocal() as session:`).
- **SQLAlchemy 2.0 Syntax Only:**
  - Query via `select(Model).where(...)`.
  - Execute via `await session.execute(...)`.
  - Fetch results via `.scalars().all()`, `.scalar_one_or_none()`, or `.scalar_one()`.
  - Synchronous legacy queries (`db.query(Model)`) are strictly prohibited.
- **Relationship Eager Loading:** Always prevent N+1 query bottlenecks by specifying `selectinload()` or `joinedload()` when related models are required in responses.

### 3.2 Error Handling & HTTP Status Codes
All endpoint errors must raise standard `HTTPException` with precise status codes and structured details:
- `400 Bad Request`: Malformed payload, invalid business logic (e.g. approval limit exceeded).
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks the requisite RBAC role or permission.
- `404 Not Found`: Entity with specified ID does not exist.
- `409 Conflict`: Duplicate unique key (e.g. email, voucher number, UTR number).
- `422 Unprocessable Entity`: Pydantic validation failure.

### 3.3 Endpoint Audit Logging Pattern
```python
# MANDATORY PATTERN for data mutations:
audit = AuditLog(
    user_id=current_user.id,
    event_type=AuditEventType.PAYMENT_DISBURSED,
    entity_type="payment_request",
    entity_id=payment_req.id,
    old_value={"status": PaymentRequestStatus.APPROVED.value},
    new_value={"status": PaymentRequestStatus.PAID.value, "utr": payment_in.utr_number},
    ip_address=get_client_ip(request),
    user_agent=request.headers.get("User-Agent", "")[:500],
)
db.add(audit)
await db.commit()
```

---

## 4. Security & Compliance Protocols

1. **Password Policies:**
   - Minimum length: 8 characters with required mix of uppercase, lowercase, numbers, and symbols.
   - Salted `bcrypt` hash with work factor 12.
2. **Secrets & Environment Isolation:**
   - No API keys, secret keys, or database credentials may be hardcoded in any file tracked by Git.
   - Use `.env` files locally and environment secrets on Vercel / Render.
3. **Session Revocation:**
   - When an administrator disables or deletes a user (`is_active = False` or `DELETE`), all active sessions and refresh tokens for that user ID must be immediately invalidated.
4. **PWA Cache Invalidation Protocol:**
   - Any modification to static icons, manifests, or core shell assets requires incrementing `CACHE_VERSION` in `frontend/public/sw.js` (e.g. `v2.0.2` -> `v2.0.3`) to prevent client browsers from serving stale cached assets.

---

## 5. Git & Release Management Conventions

### 5.1 Semantic Commit Messages
All Git commits must adhere to Conventional Commits:
- `feat(...)`: A new user-facing feature or enhancement.
- `fix(...)`: A bug fix or patch.
- `docs(...)`: Documentation updates only.
- `refactor(...)`: Code changes that neither fix bugs nor add features.
- `perf(...)`: Performance optimization changes.
- `chore(...)`: Routine maintenance, dependencies, or configuration changes.

### 5.2 Deployment Pre-Flight Checklist
Before pushing code to `main`:
1. [ ] Run `npm run build` in `frontend/` -> Verify compilation succeeds with code 0.
2. [ ] Verify backend models are registered in `backend/app/models/__init__.py`.
3. [ ] Confirm CORS configuration allows the production frontend URL (`https://frontend-inky-sigma-84.vercel.app`).
4. [ ] Ensure no debug `console.log` statements contain sensitive financial payloads.
