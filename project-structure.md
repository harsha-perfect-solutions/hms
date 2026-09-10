# HMS (Hostel Management System) — Project Structure Report

This document presents the complete and authoritative filesystem tree of the Hostel Management System (HMS), followed by concise architecture summaries for each layer of the application.

---

## 1. Project Directory Tree

```
hms/
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   │
│   ├── check-hardening-db.cjs
│   ├── check-postgres-health.cjs
│   ├── export-sqlite-data.cjs
│   ├── import-data-to-postgres.cjs
│   ├── run-all-regressions.cjs
│   ├── verify-step7-postgres.cjs
│   ├── verify-step8-postgres.cjs
│   ├── verify-step9-postgres.cjs
│   ├── verify-step12-postgres.cjs
│   ├── verify-step13-postgres.cjs
│   │
│   ├── test-auth-api.cjs
│   ├── test-dashboard-api.cjs
│   ├── test-room-api.cjs
│   ├── test-mess-api.cjs
│   ├── test-outing-api.cjs
│   ├── test-complaint-api.cjs
│   ├── test-complaints-hardening.cjs
│   ├── test-leaves-api.cjs
│   ├── test-notifications-api.cjs
│   ├── test-biometric-api.cjs
│   ├── test-management-dashboard-api.cjs
│   ├── test-block-management-api.cjs
│   ├── test-room-management-api.cjs
│   ├── test-management-mess-api.cjs
│   ├── test-management-outing-api.cjs
│   │
│   ├── prisma/
│   │   ├── dev.db                      # Legacy SQLite file (retained as backup)
│   │   ├── dev.db.backup               # Legacy SQLite snapshot backup
│   │   ├── schema.prisma               # Authoritative Prisma schema (PostgreSQL 18.6)
│   │   ├── seed.ts                     # Database seeder script
│   │   ├── sqlite-backup-data.json     # Migrated historical export
│   │   └── migrations/
│   │       ├── 20260908000000_initial_baseline/
│   │       │   └── migration.sql
│   │       └── 20260910000000_step12_room_management/
│   │           └── migration.sql
│   │
│   ├── src/
│   │   ├── index.ts                    # Express server entry point & middleware bootstrap
│   │   │
│   │   ├── config/
│   │   │   └── index.ts                # Environment variables, JWT secret, ports, CORS config
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # Student JWT authentication middleware
│   │   │   ├── management.middleware.ts # Warden/Management server-side RBAC middleware
│   │   │   └── rate-limiter.ts          # In-memory login & mutation rate limiting
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts           # Student authentication & password endpoints
│   │   │   ├── biometric.routes.ts      # Student biometric overview & gate ingestion routes
│   │   │   ├── block.routes.ts          # Block management CRUD routes
│   │   │   ├── complaint.routes.ts      # Student complaints & file attachments
│   │   │   ├── dashboard.routes.ts      # Student overview metrics & quick stats
│   │   │   ├── leave.routes.ts          # Student leaves & suspension enforcement
│   │   │   ├── management.routes.ts     # Warden/Admin authentication & portal router
│   │   │   ├── mess-management.routes.ts# Management mess token administration & stats
│   │   │   ├── mess.routes.ts           # Student meal booking & token generation
│   │   │   ├── notification.routes.ts   # Student notification list & read status
│   │   │   ├── outing-management.routes.ts # Management outing approvals & gate monitoring
│   │   │   ├── outing.routes.ts         # Student outing requests & pass generation
│   │   │   ├── room-management.routes.ts# Room creation, capacity, and student allocations
│   │   │   └── room.routes.ts           # Student "My Room" accommodation details
│   │   │
│   │   └── services/
│   │       ├── auth.service.ts          # Hashing, token generation, credential verification
│   │       ├── biometric.service.ts     # Presence calculation & physical gate correlation
│   │       ├── events.service.ts        # Server-Sent Events (SSE) domain event broker
│   │       ├── management.service.ts    # Management dashboard aggregation & analytics
│   │       ├── notification.service.ts  # Notification creation, queries, unread counts
│   │       ├── prisma.service.ts        # PrismaClient instance with PostgreSQL connection
│   │       └── storage.service.ts       # Local file upload disk storage provider
│   │
│   └── uploads/
│       └── complaints/                  # Stored attachments for student complaints
│
└── frontend/
    ├── index.html                       # Single-page application HTML template
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── tsconfig.tsbuildinfo
    ├── vite.config.ts                   # Vite bundler configuration & API proxy
    │
    ├── public/
    │   └── favicon.svg                  # Application branding icon
    │
    └── src/
        ├── App.tsx                      # Root layout, router switcher & portal switcher
        ├── index.css                    # Design tokens, layouts, animations & responsive styles
        ├── main.tsx                     # React DOM bootstrap
        │
        ├── components/
        │   ├── DashboardHeader.tsx      # Student operational header with live status
        │   ├── LoginForm.tsx            # Student authentication form
        │   ├── ManagementHeader.tsx     # Management portal operational header
        │   ├── ManagementSidebar.tsx    # Management navigation sidebar with 13 module slots
        │   ├── PasswordInput.tsx        # Accessible toggleable password field
        │   ├── PlaceholderModule.tsx    # Locked module placeholder for subsequent steps
        │   └── Sidebar.tsx              # Student navigation sidebar
        │
        ├── config/
        │   └── branding.ts              # Institutional branding configuration
        │
        ├── context/
        │   ├── AuthContext.tsx          # Student authentication state & token session
        │   └── ManagementAuthContext.tsx# Warden/Management auth state & RBAC profile
        │
        ├── pages/
        │   ├── BiometricPage.tsx        # Student gate entry/exit logs & attendance
        │   ├── BlockManagementPage.tsx  # Warden block configuration & occupancy tracking
        │   ├── ComplaintsPage.tsx       # Student ticket submission & comment timeline
        │   ├── DashboardPage.tsx        # Student main operational overview
        │   ├── LeavesPage.tsx           # Student leave applications & suspension warnings
        │   ├── LoginPage.tsx            # Student authentication screen
        │   ├── ManagementDashboardPage.tsx # Warden operational overview & metrics
        │   ├── ManagementLoginPage.tsx  # Warden & Admin dedicated login screen
        │   ├── MessManagementPage.tsx   # Warden meal tokens administration & scanner
        │   ├── MessTokensPage.tsx       # Student meal token booking & QR verification
        │   ├── MyRoomPage.tsx           # Student room, bed, and roommate details
        │   ├── NotificationsPage.tsx    # Student in-app notifications center
        │   ├── OutingApprovalsPage.tsx  # Warden review, approve, and gate transit monitor
        │   ├── OutingRequestsPage.tsx   # Student outing pass booking & digital QR pass
        │   └── RoomManagementPage.tsx   # Warden room inventory & bed allocation
        │
        ├── routes/
        │   └── ProtectedRoute.tsx       # Route guard enforcing authentication
        │
        └── services/
            └── api.ts                   # Unified typed HTTP client, auth storage & SSE listener
```

---

## 2. Architecture Summaries

### 1. Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled using Vite.
- **Routing & State**: Light client-side state machine in `App.tsx` routing between Student Portal (`/dashboard`, `/room`, `/mess`, `/outings`, `/complaints`, `/leaves`, `/biometric`, `/notifications`) and Management Portal (`/management/dashboard`, `/management/blocks`, `/management/rooms`, `/management/mess`, `/management/outings`).
- **Contexts**:
  - `AuthContext.tsx`: Manages student authentication, active token, and current student profile.
  - `ManagementAuthContext.tsx`: Manages management personnel authentication, session token, and authorized management role.
- **Styling**: Vanilla CSS in `index.css` implementing institutional design tokens (colors, typography, elevation, glassmorphism, responsive breakpoints) with zero Tailwind dependency. Fully responsive across 11 device viewports (from 320px small mobile to 1920px desktop).

### 2. Backend Architecture
- **Runtime & Framework**: Node.js with TypeScript and Express.js.
- **Modularity**: Separation of concerns into `routes/`, `middleware/`, and `services/`.
- **RBAC & Security**:
  - `auth.middleware.ts`: Authenticates students with Bearer tokens or query parameters, validating active sessions against PostgreSQL.
  - `management.middleware.ts`: Authenticates management users, enforcing strict server-side RBAC (`WARDEN`, `CHIEF_WARDEN`, `ADMIN`, `HOSTEL_ADMIN`). Student tokens are rejected with HTTP 403 Forbidden.
  - In-memory rate limiting on authentication routes and sensitive mutations.
- **Audit Logging**: Mutations across rooms, allocations, mess tokens, outings, and complaints record timestamped entries in the authoritative `ActivityLog` table.

### 3. Database / Prisma Structure
- **Database Engine**: PostgreSQL 18.6 (`hostel_management` on `localhost:5432`). (Historic SQLite `dev.db` files are retained as archived data).
- **ORM**: Prisma ORM (v5.22.0) with client generated under `backend/node_modules/@prisma/client`.
- **Core Models**:
  - `Student`: Resident profile, credentials, room info, active allocation, and role (`STUDENT` or management roles).
  - `Session`: Active JWT sessions with expiration timestamps.
  - `Block`: Residential buildings and wings (status, code, description).
  - `Room`: Physical rooms associated with blocks, tracking floor, room type, capacity, and status.
  - `RoomAllocation`: Relational bed allocations linking students to rooms with status (`ACTIVE`, `VACATED`, `REALLOCATED`).
  - `OutingRequest`: Movement passes with pass types, departure/return schedules, approval fields (`approvedAt`, `approvedBy`, `rejectedAt`, `rejectedBy`), and biometric transit timestamps (`actualExitTime`, `actualReturnTime`).
  - `MessToken`: Meal booking tokens with meal types (`BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER`), consumption status, and cancellation reasons.
  - `LeaveRequest`: Formal long-term leave requests.
  - `Suspension`: Disciplinary restrictions preventing pass booking.
  - `Complaint` & `Attachment`: Maintenance issue ticketing with comments and uploaded attachments.
  - `BiometricEvent`: Physical gate turnstile events (`ENTRY`, `EXIT`, `VERIFIED`, `REJECTED`).
  - `Notification`: In-app notification queue.
  - `ActivityLog`: Comprehensive system audit trail.

### 4. API Structure
- **Base Route Prefix**: `/api`
- **Student Endpoints**:
  - `/api/auth/*`: Login, logout, credential management.
  - `/api/student/dashboard`: Consolidated metrics and activity.
  - `/api/student/my-room`: Accommodation details and roommates.
  - `/api/student/mess-tokens/*`: Token booking, cancellation, and barcode verification.
  - `/api/student/outing-requests/*`: Outing creation, history, and active pass retrieval.
  - `/api/student/complaints/*`: Ticket submission, comment posting, and file upload.
  - `/api/student/leaves/*`: Leave request filing and cancellation.
  - `/api/student/biometric/*`: Access records, today's presence hours, and status.
  - `/api/student/notifications/*`: Notification listing and mark-as-read mutations.
- **Management Endpoints**:
  - `/api/management/auth/*`: Warden login, session verification.
  - `/api/management/dashboard/*`: Operational statistics, quick actions, today's metrics.
  - `/api/management/blocks/*`: Block creation, updates, status toggles, deletion.
  - `/api/management/rooms/*`: Room creation, updates, capacity tracking, deletion.
  - `/api/management/room-allocations/*`: Bed assignment, student reallocation, vacating.
  - `/api/management/mess/*`: Meal service overview, token consumption, cancellation.
  - `/api/management/outings/*`: Outing request KPI stats, filtering, approval, rejection.
- **Testing Endpoints**:
  - `/api/test/biometric/events`: Simulation of physical turnstile biometric scan events.

### 5. Realtime / SSE Structure
- **Broker**: `backend/src/services/events.service.ts` using Node.js `EventEmitter`.
- **Connections**:
  - Student stream: `GET /api/student/events-stream` (keyed by `studentId`).
  - Management stream: `GET /api/management/events-stream` (keyed by `managerId`).
- **Heartbeat**: 25-second keep-alive ping (`: ping\n\n`) preventing proxy and gateway timeouts.
- **Domain Event Dispatching**:
  - Emitted **only after** PostgreSQL transactions commit.
  - Dispatches domain events for complaints, leaves, notifications, biometric scans, blocks, rooms, allocations, mess tokens, and outing requests (`OUTING_APPROVED`, `OUTING_REJECTED`, `OUTING_EXIT_CONFIRMED`, `OUTING_RETURN_CONFIRMED`).
  - Automatically synchronizes UI without client polling.

### 6. Testing Structure
- **Runner**: Node.js test scripts executing via native `fetch` and Node `assert`.
- **Master Regression Suite**: `backend/run-all-regressions.cjs` orchestrates all 15 test suites:
  1. `test-auth-api.cjs` (10 tests)
  2. `test-dashboard-api.cjs` (3 tests)
  3. `test-room-api.cjs` (4 tests)
  4. `test-mess-api.cjs` (6 tests)
  5. `test-outing-api.cjs` (12 tests)
  6. `test-complaint-api.cjs` (13 tests)
  7. `test-complaints-hardening.cjs` (17 tests)
  8. `test-leaves-api.cjs` (20 tests)
  9. `test-notifications-api.cjs` (20 tests)
  10. `test-biometric-api.cjs` (24 tests)
  11. `test-management-dashboard-api.cjs` (18 tests)
  12. `test-block-management-api.cjs` (15 tests)
  13. `test-room-management-api.cjs` (20 tests)
  14. `test-management-mess-api.cjs` (22 tests)
  15. `test-management-outing-api.cjs` (17 tests)
  - **Total Coverage**: 221 automated tests, 100% passing against PostgreSQL 18.6.
- **Database Verification Scripts**: `verify-step7-postgres.cjs`, `verify-step8-postgres.cjs`, `verify-step9-postgres.cjs`, `verify-step12-postgres.cjs`, `verify-step13-postgres.cjs`.

### 7. Deployment / Docker Structure
- **Docker Status**: No `Dockerfile`, `docker-compose.yml`, or container configuration files currently exist in the repository.
- **Runtime Environment**:
  - Backend runs as a Node.js process (`npm run dev` / `ts-node` or `dist/index.js`) listening on port `5001`.
  - Frontend runs via Vite development server or static bundle (`dist/`) served by Express/Nginx listening on port `5173`.
  - Database runs as a native or system PostgreSQL instance on `localhost:5432`.
