const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Complaints & Maintenance API Test Suite (Step 16) ===\n');

  let testComplaint1 = null;
  let testComplaint2 = null;
  let wardenToken = null;
  let maintToken = null;
  let maintUser = null;
  let studentToken = null;
  let studentUser = null;

  try {
    // 1. Warden Login
    console.log('[TEST 1] Logging in as Warden (WARDEN01)...');
    const wardenLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    const wardenLoginData = await wardenLoginRes.json();
    assert.strictEqual(wardenLoginRes.status, 200, 'Warden login should succeed');
    assert.ok(wardenLoginData.token, 'Warden login should return token');
    assert.strictEqual(wardenLoginData.user.role, 'WARDEN', 'Role must be WARDEN');
    wardenToken = wardenLoginData.token;
    console.log('  -> PASS: Warden logged in successfully.');

    // 2. Maintenance Staff Login
    console.log('[TEST 2] Logging in as Maintenance Staff (MAINT01)...');
    const maintLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
    });
    const maintLoginData = await maintLoginRes.json();
    assert.strictEqual(maintLoginRes.status, 200, 'Maintenance staff login should succeed');
    assert.ok(maintLoginData.token, 'Maintenance staff login should return token');
    assert.strictEqual(maintLoginData.user.role, 'MAINTENANCE_STAFF', 'Role must be MAINTENANCE_STAFF');
    maintToken = maintLoginData.token;
    maintUser = maintLoginData.user;
    console.log('  -> PASS: Maintenance staff logged in successfully.');

    // 3. Student Login
    console.log('[TEST 3] Logging in as Student (25331A05H7)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    const studentLoginData = await studentLoginRes.json();
    assert.strictEqual(studentLoginRes.status, 200, 'Student login should succeed');
    studentToken = studentLoginData.token;
    studentUser = studentLoginData.user;
    console.log('  -> PASS: Student logged in successfully.');

    // 4. Unauthenticated Access -> 401
    console.log('[TEST 4] Unauthenticated access to /management/complaints/stats should return 401...');
    const unauthRes = await fetch(`${BASE_URL}/management/complaints/stats`);
    assert.strictEqual(unauthRes.status, 401, 'Must reject with 401');
    console.log('  -> PASS: Unauthenticated access rejected with 401.');

    // 5. Student Access to Management Complaints -> 403
    console.log('[TEST 5] Student attempting to access /management/complaints/stats should return 403...');
    const studentRbacRes = await fetch(`${BASE_URL}/management/complaints/stats`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentRbacRes.status, 403, 'Must reject student with 403');
    console.log('  -> PASS: Student access rejected with 403 Forbidden.');

    // 6. Maintenance Staff accessing management-only staff list -> 403
    console.log('[TEST 6] Maintenance staff accessing /management/complaints/maintenance-staff should return 403...');
    const maintStaffListRes = await fetch(`${BASE_URL}/management/complaints/maintenance-staff`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    assert.strictEqual(maintStaffListRes.status, 403, 'Maintenance staff cannot fetch staff list');
    console.log('  -> PASS: Fine-grained RBAC rejected non-management staff from listing personnel.');

    // 7. Warden fetching maintenance staff list -> 200
    console.log('[TEST 7] Warden fetching /management/complaints/maintenance-staff...');
    const wardenStaffListRes = await fetch(`${BASE_URL}/management/complaints/maintenance-staff`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const wardenStaffListData = await wardenStaffListRes.json();
    assert.strictEqual(wardenStaffListRes.status, 200, 'Warden can fetch staff list');
    assert.ok(Array.isArray(wardenStaffListData.data), 'Staff list must be array');
    const hasMaint01 = wardenStaffListData.data.some((s) => s.jntuNo === 'MAINT01');
    assert.ok(hasMaint01, 'MAINT01 must be included in maintenance staff list');
    console.log(`  -> PASS: Maintenance staff list retrieved (${wardenStaffListData.data.length} staff found).`);

    // 8. Warden fetching complaint stats -> 200
    console.log('[TEST 8] Warden fetching /management/complaints/stats...');
    const wardenStatsRes = await fetch(`${BASE_URL}/management/complaints/stats`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const wardenStatsData = await wardenStatsRes.json();
    assert.strictEqual(wardenStatsRes.status, 200, 'Warden can fetch stats');
    assert.ok(wardenStatsData.success, 'Stats response must indicate success');
    assert.strictEqual(typeof wardenStatsData.data.total, 'number', 'total must be number');
    assert.strictEqual(typeof wardenStatsData.data.open, 'number', 'open must be number');
    assert.strictEqual(typeof wardenStatsData.data.assigned, 'number', 'assigned must be number');
    assert.strictEqual(typeof wardenStatsData.data.inProgress, 'number', 'inProgress must be number');
    assert.strictEqual(typeof wardenStatsData.data.resolved, 'number', 'resolved must be number');
    assert.strictEqual(typeof wardenStatsData.data.closed, 'number', 'closed must be number');
    assert.strictEqual(typeof wardenStatsData.data.highPriority, 'number', 'highPriority must be number');
    assert.strictEqual(typeof wardenStatsData.data.unassigned, 'number', 'unassigned must be number');
    console.log('  -> PASS: Warden stats retrieved with all 8 KPI counters.');

    // 9. Maintenance Staff fetching complaint stats -> 200 (scoped)
    console.log('[TEST 9] Maintenance staff fetching /management/complaints/stats (scoped)...');
    const maintStatsRes = await fetch(`${BASE_URL}/management/complaints/stats`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    const maintStatsData = await maintStatsRes.json();
    assert.strictEqual(maintStatsRes.status, 200, 'Maintenance staff can fetch stats');
    assert.strictEqual(typeof maintStatsData.data.total, 'number', 'total must be number');
    console.log('  -> PASS: Scoped stats retrieved for maintenance technician.');

    // 10. Warden listing complaints with pagination -> 200
    console.log('[TEST 10] Listing complaints with pagination...');
    const listRes = await fetch(`${BASE_URL}/management/complaints?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200, 'List complaints must succeed');
    assert.ok(Array.isArray(listData.data), 'data must be array');
    assert.ok(listData.pagination, 'pagination must exist');
    assert.strictEqual(listData.pagination.page, 1, 'page must be 1');
    assert.strictEqual(listData.pagination.limit, 10, 'limit must be 10');
    console.log(`  -> PASS: Complaints list returned (${listData.pagination.total} total tickets).`);

    // 11. Filter complaints by status -> 200
    console.log('[TEST 11] Filtering complaints by status=OPEN...');
    const filterStatusRes = await fetch(`${BASE_URL}/management/complaints?status=OPEN`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const filterStatusData = await filterStatusRes.json();
    assert.strictEqual(filterStatusRes.status, 200, 'Filter by status must succeed');
    assert.ok(Array.isArray(filterStatusData.data));
    console.log('  -> PASS: Status filter applied successfully.');

    // 12. Filter complaints by priority -> 200
    console.log('[TEST 12] Filtering complaints by priority=HIGH...');
    const filterPriorityRes = await fetch(`${BASE_URL}/management/complaints?priority=HIGH`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const filterPriorityData = await filterPriorityRes.json();
    assert.strictEqual(filterPriorityRes.status, 200, 'Filter by priority must succeed');
    assert.ok(Array.isArray(filterPriorityData.data));
    console.log('  -> PASS: Priority filter applied successfully.');

    // 13. Filter complaints by category -> 200
    console.log('[TEST 13] Filtering complaints by category=ELECTRICAL...');
    const filterCategoryRes = await fetch(`${BASE_URL}/management/complaints?category=ELECTRICAL`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const filterCategoryData = await filterCategoryRes.json();
    assert.strictEqual(filterCategoryRes.status, 200, 'Filter by category must succeed');
    assert.ok(Array.isArray(filterCategoryData.data));
    console.log('  -> PASS: Category filter applied successfully.');

    // 14. Create a test complaint in PostgreSQL (status OPEN)
    console.log('[TEST 14] Creating test complaint via Prisma...');
    testComplaint1 = await prisma.complaint.create({
      data: {
        studentId: studentUser.id,
        category: 'ELECTRICAL',
        title: 'Step 16 Automated Test - Faulty Switchboard',
        description: 'The electrical switchboard in room 204 sparks intermittently when turned on.',
        location: 'Block A, Room 204',
        priority: 'HIGH',
        status: 'OPEN',
      },
    });
    assert.ok(testComplaint1.id, 'Test complaint must be created');
    assert.strictEqual(testComplaint1.status, 'OPEN');
    console.log(`  -> PASS: Created test complaint with ID: ${testComplaint1.id}`);

    // 15. Warden getting complaint details by ID -> 200
    console.log('[TEST 15] Fetching complaint detail by ID...');
    const detailRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const detailData = await detailRes.json();
    assert.strictEqual(detailRes.status, 200, 'Detail endpoint must succeed');
    assert.strictEqual(detailData.data.id, testComplaint1.id);
    assert.strictEqual(detailData.data.title, testComplaint1.title);
    assert.ok(detailData.data.student, 'Student details must be included');
    assert.strictEqual(detailData.data.student.id, studentUser.id);
    assert.ok(Array.isArray(detailData.data.attachments), 'Attachments must be array');
    console.log('  -> PASS: Complaint details verified with resident student information.');

    // 16. Invalid transition: cannot start work directly from OPEN -> 400
    console.log('[TEST 16] Attempting to start work on an OPEN complaint (must be ASSIGNED first)...');
    const invalidStartRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
    });
    assert.strictEqual(invalidStartRes.status, 400, 'Starting work on OPEN complaint must return 400');
    console.log('  -> PASS: Invalid transition OPEN -> IN_PROGRESS rejected with 400.');

    // 17. Invalid transition: cannot resolve directly from OPEN -> 400
    console.log('[TEST 17] Attempting to resolve an OPEN complaint directly...');
    const invalidResolveRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ resolutionNotes: 'Attempting invalid early resolution.' }),
    });
    assert.strictEqual(invalidResolveRes.status, 400, 'Resolving OPEN complaint must return 400');
    console.log('  -> PASS: Invalid transition OPEN -> RESOLVED rejected with 400.');

    // 18. Invalid transition: cannot close directly from OPEN -> 400
    console.log('[TEST 18] Attempting to close an OPEN complaint directly...');
    const invalidCloseRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
    });
    assert.strictEqual(invalidCloseRes.status, 400, 'Closing OPEN complaint must return 400');
    console.log('  -> PASS: Invalid transition OPEN -> CLOSED rejected with 400.');

    // 19. Assigning complaint: invalid staff ID (student ID instead of maintenance staff) -> 400
    console.log('[TEST 19] Attempting to assign complaint to a student account instead of maintenance staff...');
    const invalidStaffAssignRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ staffId: studentUser.id }),
    });
    assert.strictEqual(invalidStaffAssignRes.status, 400, 'Must reject assigning non-maintenance staff');
    console.log('  -> PASS: Validation rejected non-maintenance staff assignment.');

    // 20. Assigning complaint: non-management user (MAINT01) cannot assign -> 403
    console.log('[TEST 20] Maintenance staff attempting to assign complaint (management-only)...');
    const maintAssignAttemptRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
      body: JSON.stringify({ staffId: maintUser.id }),
    });
    assert.strictEqual(maintAssignAttemptRes.status, 403, 'Maintenance staff cannot assign complaints');
    console.log('  -> PASS: Assign endpoint RBAC correctly restricted to management roles.');

    // 21. Warden assigning complaint to MAINT01 -> 200
    console.log('[TEST 21] Warden assigning complaint to MAINT01...');
    const assignRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ staffId: maintUser.id }),
    });
    const assignData = await assignRes.json();
    assert.strictEqual(assignRes.status, 200, 'Assignment should succeed');
    assert.strictEqual(assignData.data.status, 'ASSIGNED', 'Status must be updated to ASSIGNED');
    assert.strictEqual(assignData.data.assignedToId, maintUser.id);
    assert.ok(assignData.data.assignedTo, 'assignedTo technician name must be populated');
    assert.ok(assignData.data.assignedAt, 'assignedAt timestamp must be set');
    assert.ok(assignData.data.assignedBy, 'assignedBy must be recorded');
    console.log('  -> PASS: Complaint successfully transitioned OPEN -> ASSIGNED with full audit metadata.');

    // 22. Start work: Unauthorized user (student) cannot start work -> 403
    console.log('[TEST 22] Unauthorized user attempting to start work on ASSIGNED complaint...');
    const unauthStartRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    });
    assert.strictEqual(unauthStartRes.status, 403, 'Student cannot start maintenance work');
    console.log('  -> PASS: Unauthorized start work rejected with 403.');

    // 23. Maintenance technician (MAINT01) starts work -> 200
    console.log('[TEST 23] Assigned maintenance technician (MAINT01) starts work...');
    const startRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
    });
    const startData = await startRes.json();
    assert.strictEqual(startRes.status, 200, 'Starting work must succeed');
    assert.strictEqual(startData.data.status, 'IN_PROGRESS', 'Status must be updated to IN_PROGRESS');
    console.log('  -> PASS: Complaint successfully transitioned ASSIGNED -> IN_PROGRESS.');

    // 24. Cannot start work again once already IN_PROGRESS -> 400
    console.log('[TEST 24] Attempting to start work on an already IN_PROGRESS complaint...');
    const reStartRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
    });
    assert.strictEqual(reStartRes.status, 400, 'Starting already IN_PROGRESS ticket must return 400');
    console.log('  -> PASS: Idempotency check rejected start on IN_PROGRESS ticket.');

    // 25. Resolving complaint: resolutionNotes < 10 chars -> 400
    console.log('[TEST 25] Attempting to resolve with short resolution notes (< 10 chars)...');
    const shortNotesRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
      body: JSON.stringify({ resolutionNotes: 'Fixed it' }),
    });
    assert.strictEqual(shortNotesRes.status, 400, 'Resolution notes < 10 chars must return 400');
    console.log('  -> PASS: Validation rejected short resolution notes (< 10 characters).');

    // 26. Resolving complaint: MAINT01 submits valid resolution notes -> 200
    console.log('[TEST 26] MAINT01 resolves complaint with comprehensive repair notes...');
    const validNotes = 'Replaced the damaged electrical switchboard panel and tested with multimeter.';
    const resolveRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
      body: JSON.stringify({ resolutionNotes: validNotes }),
    });
    const resolveData = await resolveRes.json();
    assert.strictEqual(resolveRes.status, 200, 'Resolving complaint must succeed');
    assert.strictEqual(resolveData.data.status, 'RESOLVED', 'Status must be updated to RESOLVED');
    assert.strictEqual(resolveData.data.resolutionNotes, validNotes);
    assert.ok(resolveData.data.resolvedAt, 'resolvedAt must be recorded');
    assert.ok(resolveData.data.resolvedBy, 'resolvedBy must be recorded');
    console.log('  -> PASS: Complaint successfully transitioned IN_PROGRESS -> RESOLVED.');

    // 27. Maintenance technician attempting to close ticket -> 403 (management only)
    console.log('[TEST 27] Maintenance technician attempting to close complaint (management-only)...');
    const maintCloseRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
    });
    assert.strictEqual(maintCloseRes.status, 403, 'Maintenance staff cannot close complaints');
    console.log('  -> PASS: Non-management role rejected from closing complaint.');

    // 28. Warden formally closes complaint -> 200
    console.log('[TEST 28] Warden formally closes the verified complaint...');
    const closeRes = await fetch(`${BASE_URL}/management/complaints/${testComplaint1.id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
    });
    const closeData = await closeRes.json();
    assert.strictEqual(closeRes.status, 200, 'Closing complaint must succeed');
    assert.strictEqual(closeData.data.status, 'CLOSED', 'Status must be updated to CLOSED');
    assert.ok(closeData.data.closedAt, 'closedAt timestamp must be recorded');
    assert.ok(closeData.data.closedBy, 'closedBy must be recorded');
    console.log('  -> PASS: Complaint successfully transitioned RESOLVED -> CLOSED.');

    console.log('\n====================================================');
    console.log('Passed: 28/28 tests passed');
    console.log('=== ALL 28 STEP 16 MANAGEMENT COMPLAINTS & MAINTENANCE TESTS PASSED! ===\n');
  } finally {
    console.log('Cleaning up test complaints in PostgreSQL...');
    try {
      if (testComplaint1?.id) {
        await prisma.notification.deleteMany({
          where: { entityId: testComplaint1.id },
        });
        await prisma.complaint.deleteMany({
          where: { id: testComplaint1.id },
        });
      }
      if (testComplaint2?.id) {
        await prisma.notification.deleteMany({
          where: { entityId: testComplaint2.id },
        });
        await prisma.complaint.deleteMany({
          where: { id: testComplaint2.id },
        });
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
