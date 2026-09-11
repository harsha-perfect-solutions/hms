# Step 17 — Outing Log History: Implementation Plan

## 1. Executive Summary & Objective

The **Outing Log History** module (`/management/outing-log-history`) in the HMS Admin Portal provides management and security staff with an authoritative, read-only historical record of student outing requests, lifecycle state transitions, approval workflows, and physical gate movements (including biometric transits).

This module is strictly an **observability/history** system. Historical records are immutable and cannot be altered or deleted from this interface.

---

## 2. Existing Architecture & Reusable Domain Models

The existing PostgreSQL 18.6 schema already maintains authoritative records of outing lifecycles and physical movements. **No redundant tables are needed.**

### Authoritative Models
1. **`OutingRequest`**:
   - Primary lifecycle entity:
     - Identification: `id`, `requestNumber` (e.g. `OUT-20260910-LOC-XXXX`)
     - Student reference: `studentId` (relation to `Student`, `roomAllocations`, `block`)
     - Purpose & Destination: `passType` (`LOCAL_OUTING`, `EMERGENCY`, `NIGHT_OUT`), `destination`, `purpose`, `emergencyContact`, `remarks`
     - Schedule: `outDate`, `returnDate`
     - Physical transits: `actualExitTime`, `actualReturnTime`
     - Workflow: `approvedAt`, `approvedBy`, `rejectedAt`, `rejectedBy`, `rejectionReason`
     - Authoritative status: `PENDING`, `APPROVED`, `OUT`, `RETURNED`, `REJECTED`, `CANCELLED`
     - Timestamps: `createdAt`, `updatedAt`
2. **`BiometricEvent`**:
   - Physical transit log:
     - `eventType` (`ENTRY`, `EXIT`), `direction` (`IN`, `OUT`), `verificationStatus` (`VERIFIED`, `REJECTED`)
     - `eventTimestamp`, `source` (`BIOMETRIC_DEVICE`, `RFID`, `MANUAL_GATE`, `SYSTEM`), `gate`, `deviceId`, `deviceLabel`
3. **`ActivityLog`**:
   - System audit trail with `actionType: 'OUTING'`, tracking `APPROVE`, `REJECT`, `CANCEL`, `MARK_OUT`, `MARK_RETURNED`.

---

## 3. Authoritative Outing Lifecycle & Timeline Interpretation

The timeline distinguishes administrative authorization from physical movement:

```
[ 1. REQUESTED ]
      │  (Student submits request on Student Portal; timestamp: createdAt)
      ▼
[ 2. APPROVAL / REJECTION ]
      ├── APPROVED (Warden approves; timestamp: approvedAt, actor: approvedBy)
      └── REJECTED (Warden rejects; timestamp: rejectedAt, actor: rejectedBy, reason)
      │
      ▼ (Only if APPROVED)
[ 3. PHYSICAL EXIT (ACTIVE / OUT) ]
      │  (Student presents biometrics/gate check; timestamp: actualExitTime)
      │  (Status transitions to OUT / ACTIVE)
      ▼
[ 4. PHYSICAL RETURN (RETURNED) ]
         (Student returns through biometric entry gate; timestamp: actualReturnTime)
         (Status transitions to RETURNED)
```

**Critical Business Rules**:
- `APPROVED` does **not** equal physical exit.
- `OUT` / `ACTIVE` strictly confirms physical exit (`actualExitTime` is recorded).
- `RETURNED` strictly confirms physical return (`actualReturnTime` is recorded).

---

## 4. API Design

Mounted under `/api/management/outing-log-history`:

### 4.1. List Outing Log History
`GET /api/management/outing-log-history`

**Query Parameters**:
- `page` (number, default: 1)
- `pageSize` / `limit` (number, default: 25, bounded max: 100)
- `search` (string: student name, JNTU number, request number, destination)
- `studentId` (UUID)
- `requestNumber` (string)
- `movementType` (`ALL`, `REQUESTED`, `APPROVED`, `REJECTED`, `EXIT`, `RETURN`, `CANCELLED`)
- `status` (`ALL`, `PENDING`, `APPROVED`, `OUT`, `RETURNED`, `REJECTED`, `CANCELLED`)
- `source` (`ALL`, `BIOMETRIC_DEVICE`, `MANUAL_GATE`, `STUDENT_PORTAL`, `MANAGEMENT_PORTAL`)
- `from` (ISO date string)
- `to` (ISO date string)

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "requestNumber": "OUT-20260910-LOC-ABCD",
      "student": {
        "id": "uuid",
        "name": "Student Name",
        "jntuNo": "25331A05H7",
        "blockName": "Girls-Block-B",
        "roomNumber": "119"
      },
      "passType": "LOCAL_OUTING",
      "destination": "City Center",
      "purpose": "Academic Books",
      "outDate": "2026-09-10T14:00:00.000Z",
      "returnDate": "2026-09-10T20:00:00.000Z",
      "actualExitTime": "2026-09-10T14:15:00.000Z",
      "actualReturnTime": "2026-09-10T19:45:00.000Z",
      "status": "RETURNED",
      "approvedBy": "Warden Name",
      "approvedAt": "2026-09-10T11:00:00.000Z",
      "source": "BIOMETRIC_DEVICE",
      "movementType": "RETURN",
      "createdAt": "2026-09-10T09:00:00.000Z"
    }
  ],
  "stats": {
    "todayRequests": 12,
    "todayApproved": 10,
    "todayExits": 8,
    "todayReturns": 6,
    "currentlyOutside": 2
  },
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 120,
    "totalPages": 5
  }
}
```

### 4.2. Outing Detail & Timeline
`GET /api/management/outing-log-history/:id`

**Response Structure**:
- Full outing record
- Student details (room, block, contact)
- Chronological visual timeline stages (`REQUESTED`, `APPROVED`/`REJECTED`, `EXIT`, `RETURN`)
- Correlated biometric transits around outing dates
- Activity logs

---

## 5. RBAC & Security

- **Authentication**: `authenticateManagement` middleware validates JWT.
- **Role Enforcement**: Restricted to `ADMIN`, `HOSTEL_ADMIN`, `CHIEF_WARDEN`, `WARDEN`.
- **Student Exclusion**: Students rejected with `403 Forbidden`.
- **Unauthenticated**: Rejected with `401 Unauthorized`.
- **Read-Only**: Zero mutating (PUT/POST/PATCH/DELETE) endpoints exist on this module.
- **IDOR Protection**: Validated parameter types, bounds checks, sanitized search strings.

---

## 6. Realtime Synchronization (SSE)

- Client connects to `/api/events/management`.
- Listens for domain events:
  - `OUTING_CREATED`
  - `OUTING_APPROVED`
  - `OUTING_REJECTED`
  - `OUTING_EXIT_CONFIRMED`
  - `OUTING_RETURN_CONFIRMED`
  - `OUTING_STATS_UPDATED`
- When an event is received, client automatically refetches authoritative data from PostgreSQL without full page reloads.

---

## 7. Frontend Layout & Responsive Design

- **Route**: `/management/outing-log-history`
- **Sidebar**: Update `ManagementSidebar.tsx`: replace `Outing Log History [LOCK] SOON` with active link `/management/outing-log-history`.
- **Top KPI Cards**: 5 compact KPI metrics.
- **Filter Toolbar**: Search, Movement Type, Outing Status, Source, Date From, Date To, Apply, Clear.
- **Desktop Table**: Columns for Date/Time, Student, Roll No., Request No., Event, Status, Destination, Source, Recorded By, Action.
- **Mobile Cards (<768px, 412px, 390px, 320px)**: Collapses into clean cards with zero horizontal overflow.
- **Outing Log Details Modal**: Complete view with timeline, student context, and correlated movements.

---

## 8. Verification & Test Plan

1. **Dedicated Suite (`backend/test-management-outing-log-history.cjs`)**:
   - 24 comprehensive tests covering auth, RBAC, IDOR, pagination, search, status filters, date range filters, movement type filters, source filters, detail endpoint, timeline generation, read-only guarantee, and KPI metrics.
2. **Master Regression Runner (`backend/run-all-regressions.cjs`)**:
   - All 428 existing baseline tests + new tests (>=452 total) must pass.
3. **Type Checking & Production Build**:
   - Backend `tsc --noEmit` & `npm run build`
   - Frontend `tsc --noEmit` & `npm run build`
4. **Browser & Responsive Testing**:
   - Active sidebar navigation, filter actions, detail modal view, timeline inspection, 390px/320px responsive cards.
