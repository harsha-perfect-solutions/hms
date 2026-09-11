# Step 18 — Device Management: Production Implementation Plan

## 1. Executive Summary & Objective

The **Device Management** module (`/management/devices`) in the HMS Admin Portal provides administrative control over physical hostel biometric sensors, gate readers, RFID scanners, and turnstiles.

### Core Objectives:
1. **Device Registry**: Authoritative registration and cataloging of physical gate/turnstile hardware (`BiometricDevice`).
2. **Security & Credential Lifecycle**:
   - Zero plaintext credential storage.
   - Cryptographically secure API token generation.
   - One-time display at creation or rotation with explicit warnings.
   - Credentials NEVER returned in GET list, GET detail, logs, SSE, or audit records.
3. **Authoritative Operational Health**:
   - Status (`ONLINE`, `OFFLINE`, `DISABLED`, `MAINTENANCE`) derived strictly from real event telemetry and configuration, never simulated with timers.
   - Real-time event integration: when a device sends a `BiometricEvent`, the device's `lastSeenAt` and `status` are updated.
4. **Administrative Controls**:
   - Register, Edit, Enable, Disable, Rotate Credential, and Activity Inspection.
   - Safe deactivation (`isEnabled = false`) over destructive deletions to preserve historical biometric and outing transit records.
5. **Real-time Observability**:
   - SSE notification on state changes (`DEVICE_CREATED`, `DEVICE_UPDATED`, `DEVICE_ENABLED`, `DEVICE_DISABLED`, `DEVICE_CREDENTIAL_ROTATED`).
6. **Zero Regressions**:
   - Baseline of 453/453 tests across 24 suites must remain 100% green.

---

## 2. PostgreSQL 18.6 Data Model (`BiometricDevice`)

```prisma
model BiometricDevice {
  id                   String           @id @default(uuid())
  deviceIdentifier     String           @unique // e.g. "DEV-GATE-01", "DEV-TURNSTILE-02"
  name                 String           // e.g. "Main Gate Biometric Reader #1"
  deviceType           String           // BIOMETRIC, GATE_READER, RFID, TURNSTILE, OTHER
  location             String           // e.g. "Main Hostel Gate", "Mess Entrance", "Block A Entry"
  description          String?
  status               String           @default("OFFLINE") // ONLINE, OFFLINE, MAINTENANCE, DISABLED
  isEnabled            Boolean          @default(true)
  apiKeyHash           String?          // SHA-256 hash of device secret; NEVER store plaintext
  keyLastRotatedAt     DateTime?
  lastSeenAt           DateTime?
  ipAddress            String?
  macAddress           String?
  firmwareVersion      String?
  maintenanceNotes     String?
  lastMaintenanceDate  DateTime?
  configMetadata       String?          // JSON string for device configs
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@index([deviceIdentifier])
  @@index([deviceType])
  @@index([status])
  @@index([isEnabled])
  @@index([lastSeenAt])
  @@index([location])
}
```

---

## 3. Endpoints & API Specification

All routes mounted under `/api/management/devices`:

1. `GET /api/management/devices`
   - Bounded pagination (`page`, `pageSize` bounded to 1–100, default 25).
   - Filters: `search` (name, identifier, location), `type`, `status`, `enabled`, `location`.
   - Aggregated KPIs: `totalDevices`, `activeDevices`, `disabledDevices`, `onlineDevices`, `offlineDevices`, `maintenanceDevices`.
   - Returns sanitized records with **zero** credential material.
2. `GET /api/management/devices/:id`
   - Detailed record, maintenance notes, configuration metadata, and telemetry event aggregates (total events, last event timestamp, verification stats).
3. `POST /api/management/devices`
   - Body: `{ name, deviceIdentifier, deviceType, location, description?, isEnabled?, ipAddress?, macAddress?, firmwareVersion? }`.
   - Generates cryptographically secure API key, hashes with SHA-256 for persistence, and returns plaintext key **strictly once** in creation response with a warning banner.
   - Logs `ActivityLog` with `actionType: 'SYSTEM'`.
   - Emits `DEVICE_CREATED` via SSE.
4. `PUT /api/management/devices/:id`
   - Update safe administrative fields: `name`, `location`, `deviceType`, `description`, `maintenanceNotes`, `lastMaintenanceDate`, `ipAddress`, `macAddress`, `firmwareVersion`.
   - Immutable identity field: `deviceIdentifier` cannot be arbitrarily modified.
   - Emits `DEVICE_UPDATED` via SSE.
5. `POST /api/management/devices/:id/enable`
   - Enables device (`isEnabled: true`, status recalculated from `lastSeenAt`).
   - Emits `DEVICE_ENABLED` via SSE.
6. `POST /api/management/devices/:id/disable`
   - Disables device (`isEnabled: false`, status: `DISABLED`).
   - Emits `DEVICE_DISABLED` via SSE.
7. `POST /api/management/devices/:id/rotate-credential`
   - Generates new cryptographic token, invalidates old token, hashes and stores new key, returns new key **once** in response.
   - Emits `DEVICE_CREDENTIAL_ROTATED` via SSE.
8. `GET /api/management/devices/:id/activity`
   - Returns paginated audit and event activity related to this device.

---

## 4. Biometric Ingestion Correlation

In `biometric.service.ts`:
When a device sends a biometric event with `deviceId: "DEV-GATE-01"`, if a registered `BiometricDevice` matches that `deviceIdentifier`:
- Automatically update `lastSeenAt = now()`.
- If `isEnabled` and not in `MAINTENANCE`, update `status = 'ONLINE'`.

---

## 5. RBAC & Security Matrix

- Unauthenticated: `401 Unauthorized`.
- Student tokens: `403 Forbidden`.
- Non-management tokens: `403 Forbidden`.
- Authorized Management Roles: `ADMIN`, `HOSTEL_ADMIN`, `CHIEF_WARDEN`, `WARDEN`.
- Sensitive Data: Passwords, tokens, API key hashes, and raw biometric templates are strictly omitted.

---

## 6. Frontend Architecture & User Experience

1. **Sidebar**:
   - Update `ManagementSidebar.tsx`: Change `devices` item from `isAvailable: false` to `isAvailable: true`, removing `[LOCK] SOON`.
2. **Page Component**:
   - `frontend/src/pages/ManagementDevicePage.tsx`:
     - 6 Authoritative KPI summary cards.
     - Search & Filter bar (Type, Status, Enabled, Location, Search text, Apply, Clear, Refresh).
     - Desktop data table (Name, Identifier, Type, Location, Status badge, Last Communication, Enabled toggle/badge, Actions).
     - Mobile stacked cards layout (`<=768px`) tested down to `320px` with zero horizontal overflow.
3. **Modals**:
   - Register Device Modal (Form + one-time credential display modal with copy-to-clipboard and warning).
   - Edit Device Modal.
   - Device Details Modal (Identity, Configuration, Status, Telemetry summary, Maintenance, Masked Security).
   - Rotate Credential Confirmation & Display Modal.
   - Disable/Enable Confirmation Dialog.
4. **Realtime**:
   - SSE listener refetches device records upon `DEVICE_CREATED`, `DEVICE_UPDATED`, `DEVICE_ENABLED`, `DEVICE_DISABLED`, `DEVICE_CREDENTIAL_ROTATED`.

---

## 7. Verification Plan

1. **Prisma Migration**: Add `BiometricDevice` model, run `npx prisma db push` and `npx prisma generate`.
2. **Dedicated Automated Test Suite**: `backend/test-management-device-api.cjs` (30+ tests covering RBAC, CRUD, validation, credential security, filters, pagination, SSE, and health).
3. **Master Regression**: `backend/run-all-regressions.cjs` ensuring all 453+ tests pass.
4. **Type Check**: `npx tsc --noEmit` in backend and frontend (0 errors).
5. **Build**: `npm run build` in backend and frontend.
6. **Browser Subagent Testing**: Desktop 1440x900, Tablet 768x1024, Mobile 390x844 and 320x600.
