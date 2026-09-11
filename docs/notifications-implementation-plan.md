# Step 19 — Admin Notifications: Production Implementation Plan

## 1. Executive Summary & Objective

**Step 19 — Notifications** is the final feature module of the HMS Admin Portal. It implements an administrative notification control center (`/management/notifications`) and seamlessly integrates it with the existing Student Portal notification infrastructure.

### Core Objectives:
1. **Administrative Notification Center**: Provide an authoritative dashboard and history at `/management/notifications` for hostel administrators.
2. **Targeted Recipient Resolution**: Support targeting of individual students, selected multiple students, all active students, specific roles, blocks, or rooms without trusting client assumptions.
3. **Atomic Multi-Recipient Delivery**: Create authoritative PostgreSQL records per recipient using `createMany` / transactional batches, preventing artificial "broadcast" anomalies.
4. **Authoritative Real-Time Delivery**: Emit SSE domain events after database transaction commit, instantly updating both student and administrative clients without polling.
5. **Operational Integration**: Preserve all automated domain notifications (Complaints, Leaves, Outings, Mess, Biometrics, Fees, Devices) while enabling administrative announcements.
6. **Zero Plaintext Credentials or Secret Leakage**: Strict sanitization of metadata and rejection of external URL injection in deep links.
7. **Zero Regression Guarantee**: Preserve 100% green status on all 485 previous tests (including the 20 existing notification tests in `test-notifications-api.cjs`).

---

## 2. PostgreSQL 18.6 Data Model Enhancement

Safely extend the existing `Notification` model in `backend/prisma/schema.prisma` with optional and default fields:

```prisma
model Notification {
  id          String    @id @default(uuid())
  studentId   String
  student     Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  title       String
  message     String
  type        String    @default("INFO") // INFO, WARNING, SUCCESS
  category    String    @default("SYSTEM") // OUTING, LEAVE, COMPLAINT, MESS, SUSPENSION, ROOM, SYSTEM, ANNOUNCEMENT, BIOMETRIC, FEE, DEVICE
  priority    String    @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  source      String    @default("SYSTEM") // SYSTEM, ADMIN_PORTAL, AUTOMATED
  createdBy   String?   // Admin username or actor
  isRead      Boolean   @default(false)
  readAt      DateTime?
  entityId    String?
  link        String?
  expiresAt   DateTime?
  metadata    String?   // JSON stringified safe metadata
  createdAt   DateTime  @default(now())

  @@index([studentId])
  @@index([category])
  @@index([isRead])
  @@index([priority])
  @@index([source])
  @@index([createdAt])
}
```

*Backward compatibility:* All new fields are either optional or have `@default` values, ensuring existing student queries and tests continue without regression.

---

## 3. Production API Endpoints (`/api/management/notifications`)

Guarded by `authenticateManagement` and `requireRoles('ADMIN', 'HOSTEL_ADMIN', 'CHIEF_WARDEN', 'WARDEN')`:

1. `GET /api/management/notifications` — Paginated history with search, category, priority, status, date filters, and live KPIs.
2. `GET /api/management/notifications/:id` — Detail view including recipient student details and sanitized metadata.
3. `POST /api/management/notifications` — Send targeted notifications with server-side recipient resolution, validation, transactional creation, audit logging, and post-commit SSE event emission.
4. `GET /api/management/notifications/recipients/resolve` — Helper endpoint to resolve and count eligible recipients for a given scope (preview before sending).
5. `GET /api/management/notifications/stats` — Authoritative PostgreSQL KPI metrics.

---

## 4. Recipient Targeting & Deduplication

- **Scopes Supported**:
  - `ALL_STUDENTS`: All active resident students.
  - `INDIVIDUAL`: Single student by ID or JNTU number.
  - `MULTIPLE`: Selected list of student IDs.
  - `BLOCK`: All residents allocated to a specific block.
  - `ROOM`: All residents allocated to a specific room.
  - `ROLE`: All active users matching a specific role (e.g., `STUDENT`, `WARDEN`).
- **Deduplication**: `Array.from(new Set(resolvedIds))` ensures no student receives duplicate records from overlapping criteria in a single broadcast.
- **Validation**: Empty recipient resolutions are rejected with `400 Bad Request`.

---

## 5. Security, Sanitization & Deep Links

- **URL Validation**: Notification links must be internal relative routes (must start with `/`, e.g., `/management/complaints` or `/outing-requests`). Rejects `http://`, `https://`, `javascript:`, or protocol-relative schemes.
- **Metadata Sanitization**: Central `sanitizeAuditMetadata` runs on all metadata fields to guarantee no passwords, JWTs, device secrets, or biometric templates can be stored or returned.
- **Server-Side RBAC**: Unauthenticated callers receive 401; student tokens attempting to access management notification APIs receive 403 Forbidden.

---

## 6. Real-Time Domain Events (SSE)

- Emitted strictly **after** transaction commit via `complaintEventsService`.
- For recipient students: `emitNotificationEventToStudent(studentId, { type: 'NOTIFICATION_CREATED', ... })`.
- For management dashboards: `emitManagementDashboardUpdate({ type: 'NOTIFICATION_BROADCAST_CREATED', ... })`.
- Automatic client synchronization without `setInterval` or `setTimeout` polling loops.

---

## 7. Verification & Testing Strategy

1. **Existing Test Suite**: Verify `backend/test-notifications-api.cjs` passes 20/20.
2. **Dedicated Step 19 Suite**: Build `backend/test-management-notifications.cjs` with 40+ tests covering auth, recipient resolution, deduplication, deep link security, audit, and realtime delivery.
3. **Master Regression**: Add to `backend/run-all-regressions.cjs` (26th suite). Target: **525+ tests green (100%)**.
4. **PostgreSQL 18.6 Script**: Execute `backend/verify-step19-postgres.cjs` verifying data persistence, indexes, and absence of secret leakage.
5. **Browser Testing**: Use `browser_subagent` to test creation, recipient selection, preview, send, student portal reception, mark read, and responsive layouts across desktop, tablet, and mobile.
