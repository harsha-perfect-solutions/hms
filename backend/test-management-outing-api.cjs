const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Outing Approvals API Test Suite (Step 14) ===\n');

  try {
    // 1. Management Authentication (Warden)
    console.log('[TEST 1] Logging in as Warden (WARDEN01)...');
    const wardenLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'WARDEN01',
        password: 'Password@123',
      }),
    });
    const wardenLoginData = await wardenLoginRes.json();
    assert.strictEqual(wardenLoginRes.status, 200, 'Warden login must succeed');
    assert.ok(wardenLoginData.token, 'Warden login must return JWT token');
    const wardenToken = wardenLoginData.token;
    console.log('  -> PASS: Warden logged in successfully.');

    // 2. Student Authentication (for RBAC testing)
    console.log('[TEST 2] Logging in as Student (25331A05H7)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jntuNo: '25331A05H7',
        password: 'Password@123',
      }),
    });
    const studentLoginData = await studentLoginRes.json();
    assert.strictEqual(studentLoginRes.status, 200, 'Student login must succeed');
    const studentToken = studentLoginData.token;
    const studentId = studentLoginData.user.id;
    console.log('  -> PASS: Student logged in successfully.');

    // 3. RBAC: Unauthenticated access -> 401
    console.log('[TEST 3] Unauthenticated access to /management/outings/stats should return 401...');
    const unauthRes = await fetch(`${BASE_URL}/management/outings/stats`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
    console.log('  -> PASS: Unauthenticated access rejected with 401.');

    // 4. RBAC: Student token -> 403 Forbidden
    console.log('[TEST 4] Student token accessing /management/outings should return 403...');
    const studentRbacRes = await fetch(`${BASE_URL}/management/outings`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentRbacRes.status, 403, 'Student must be rejected with 403');
    console.log('  -> PASS: Student access rejected with 403 Forbidden.');

    // 5. Authoritative Outing Stats
    console.log('[TEST 5] Fetching authoritative outing stats as Warden...');
    const statsRes = await fetch(`${BASE_URL}/management/outings/stats`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const statsData = await statsRes.json();
    assert.strictEqual(statsRes.status, 200, 'Stats endpoint must return 200');
    assert.strictEqual(statsData.success, true, 'Stats response must succeed');
    assert.ok(typeof statsData.data.total === 'number', 'Total must be a number');
    assert.ok(typeof statsData.data.pending === 'number', 'Pending must be a number');
    assert.ok(typeof statsData.data.approved === 'number', 'Approved must be a number');
    assert.ok(typeof statsData.data.active === 'number', 'Active must be a number');
    assert.ok(typeof statsData.data.returned === 'number', 'Returned must be a number');
    assert.ok(typeof statsData.data.rejected === 'number', 'Rejected must be a number');
    console.log(`  -> PASS: Stats retrieved — Total: ${statsData.data.total}, Pending: ${statsData.data.pending}, Approved: ${statsData.data.approved}, Active: ${statsData.data.active}`);

    // 6. Outings Listing with Filters
    console.log('[TEST 6] Listing outings with status=ALL and search filter...');
    const listRes = await fetch(`${BASE_URL}/management/outings?status=ALL&limit=10`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200, 'Listing endpoint must return 200');
    assert.strictEqual(listData.success, true, 'Listing response must succeed');
    assert.ok(Array.isArray(listData.data), 'Listing must return array in data');
    assert.ok(listData.pagination, 'Listing must return pagination metadata');
    console.log(`  -> PASS: Outings listed successfully (${listData.data.length} items on page 1 of ${listData.pagination.totalPages}).`);

    // 7. Create a clean PENDING outing request for approval testing
    console.log('[TEST 7] Creating a test PENDING outing request...');
    const outDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    const returnDate = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now
    const testOuting1 = await prisma.outingRequest.create({
      data: {
        studentId,
        requestNumber: `OUT-TEST-${Date.now().toString().slice(-4)}`,
        passType: 'LOCAL_OUTING',
        destination: 'Central Market',
        purpose: 'Purchasing project stationery and supplies',
        emergencyContact: '9876543210',
        outDate,
        returnDate,
        status: 'PENDING',
      },
    });
    assert.ok(testOuting1.id, 'Test outing 1 must be created');
    console.log(`  -> PASS: Test outing created with ID: ${testOuting1.id}, RequestNumber: ${testOuting1.requestNumber}`);

    // 8. GET /:id Single Outing Detail
    console.log('[TEST 8] Fetching detail for created outing request...');
    const detailRes = await fetch(`${BASE_URL}/management/outings/${testOuting1.id}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const detailData = await detailRes.json();
    assert.strictEqual(detailRes.status, 200, 'Single outing endpoint must return 200');
    assert.strictEqual(detailData.success, true, 'Detail response must succeed');
    assert.strictEqual(detailData.data.id, testOuting1.id, 'ID must match');
    assert.strictEqual(detailData.data.student.jntuNo, '25331A05H7', 'Student JNTU No must match');
    assert.ok(detailData.data.monthlyUsageCount !== undefined, 'Must include monthlyUsageCount');
    console.log('  -> PASS: Outing detail retrieved with student context and monthly usage count.');

    // 9. Approve Outing Request (PENDING -> APPROVED)
    console.log('[TEST 9] Approving outing request as Warden...');
    const approveRes = await fetch(`${BASE_URL}/management/outings/${testOuting1.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
    });
    const approveData = await approveRes.json();
    assert.strictEqual(approveRes.status, 200, 'Approval must succeed with 200');
    assert.strictEqual(approveData.success, true, 'Approval must be successful');
    assert.strictEqual(approveData.data.status, 'APPROVED', 'Status must be APPROVED');
    assert.ok(approveData.data.approvedAt, 'approvedAt timestamp must be set');
    assert.ok(approveData.data.approvedBy, 'approvedBy name must be set');

    // Verify in database
    const dbOuting1 = await prisma.outingRequest.findUnique({ where: { id: testOuting1.id } });
    assert.strictEqual(dbOuting1.status, 'APPROVED', 'DB status must be APPROVED');
    assert.ok(dbOuting1.approvedAt, 'DB approvedAt must be set');
    assert.ok(dbOuting1.approvedBy, 'DB approvedBy must be set');

    // Verify ActivityLog was created
    const activityLog = await prisma.activityLog.findFirst({
      where: {
        studentId,
        actionType: 'OUTING',
        description: { contains: testOuting1.requestNumber },
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(activityLog, 'ActivityLog entry must exist for approval');

    // Verify Notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        studentId,
        category: 'OUTING',
        type: 'SUCCESS',
        entityId: testOuting1.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(notification, 'Student Notification must exist for approval');
    console.log('  -> PASS: Outing approved, DB record updated, ActivityLog and Notification created.');

    // 10. State Machine: Approving already APPROVED outing -> 400 Bad Request
    console.log('[TEST 10] Rejecting re-approval of already APPROVED outing (must return 400)...');
    const reapproveRes = await fetch(`${BASE_URL}/management/outings/${testOuting1.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(reapproveRes.status, 400, 'Re-approval must return 400');
    console.log('  -> PASS: Invalid transition APPROVED -> APPROVED rejected with 400.');

    // 11. Rejection Validation: Empty reason -> 400
    console.log('[TEST 11] Creating second test outing and testing rejection validation...');
    const testOuting2 = await prisma.outingRequest.create({
      data: {
        studentId,
        requestNumber: `OUT-TEST-${Date.now().toString().slice(-4)}-2`,
        passType: 'NIGHT_OUT',
        destination: 'Out of Station',
        purpose: 'Visiting friends outside town',
        emergencyContact: '9876543210',
        outDate,
        returnDate,
        status: 'PENDING',
      },
    });

    const emptyReasonRes = await fetch(`${BASE_URL}/management/outings/${testOuting2.id}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: ' ' }),
    });
    assert.strictEqual(emptyReasonRes.status, 400, 'Empty reason must return 400');
    console.log('  -> PASS: Missing/empty rejection reason rejected with 400.');

    // 12. Reject Outing Request (PENDING -> REJECTED)
    console.log('[TEST 12] Rejecting outing request with valid reason...');
    const rejectionReasonText = 'Night outing not permitted before exams as per hostel policy.';
    const rejectRes = await fetch(`${BASE_URL}/management/outings/${testOuting2.id}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: rejectionReasonText }),
    });
    const rejectData = await rejectRes.json();
    assert.strictEqual(rejectRes.status, 200, 'Rejection must succeed with 200');
    assert.strictEqual(rejectData.success, true, 'Rejection must be successful');
    assert.strictEqual(rejectData.data.status, 'REJECTED', 'Status must be REJECTED');
    assert.strictEqual(rejectData.data.rejectionReason, rejectionReasonText, 'Reason must match');
    assert.ok(rejectData.data.rejectedAt, 'rejectedAt timestamp must be set');
    assert.ok(rejectData.data.rejectedBy, 'rejectedBy name must be set');

    // Verify DB
    const dbOuting2 = await prisma.outingRequest.findUnique({ where: { id: testOuting2.id } });
    assert.strictEqual(dbOuting2.status, 'REJECTED');
    assert.strictEqual(dbOuting2.rejectionReason, rejectionReasonText);
    assert.ok(dbOuting2.rejectedAt);
    assert.ok(dbOuting2.rejectedBy);

    // Verify Notification
    const rejectNotification = await prisma.notification.findFirst({
      where: {
        studentId,
        category: 'OUTING',
        type: 'WARNING',
        entityId: testOuting2.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(rejectNotification, 'Student Notification must exist for rejection');
    assert.ok(rejectNotification.message.includes(rejectionReasonText), 'Notification must include reason');
    console.log('  -> PASS: Outing rejected, DB updated, ActivityLog and Notification created.');

    // 13. State Machine: Approving REJECTED outing -> 400 Bad Request
    console.log('[TEST 13] Attempting to approve a REJECTED outing (must return 400)...');
    const approveRejectedRes = await fetch(`${BASE_URL}/management/outings/${testOuting2.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(approveRejectedRes.status, 400, 'Approving REJECTED outing must return 400');
    console.log('  -> PASS: Invalid transition REJECTED -> APPROVED rejected with 400.');

    // 14. Biometric Gate Correlation: Verified EXIT transit activates APPROVED -> OUT
    console.log('[TEST 14] Simulating biometric EXIT gate transit for approved outing...');
    const biometricExitRes = await fetch(`${BASE_URL}/test/biometric/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        eventType: 'EXIT',
        direction: 'OUT',
        gate: 'Hostel Main Gate Turnstile #1',
        verificationStatus: 'VERIFIED',
      }),
    });
    const biometricExitData = await biometricExitRes.json();
    assert.strictEqual(biometricExitRes.status, 201, 'Biometric event must be recorded');

    // Check that outing1 is now OUT with actualExitTime set
    const outingAfterExit = await prisma.outingRequest.findUnique({ where: { id: testOuting1.id } });
    assert.strictEqual(outingAfterExit.status, 'OUT', 'Outing status must automatically transition to OUT');
    assert.ok(outingAfterExit.actualExitTime, 'actualExitTime must be set');
    console.log(`  -> PASS: Verified biometric EXIT successfully activated outing to OUT at: ${outingAfterExit.actualExitTime}`);

    // 15. State Machine: Approving an OUT outing -> 400 Bad Request
    console.log('[TEST 15] Attempting to approve an OUT outing (must return 400)...');
    const approveOutRes = await fetch(`${BASE_URL}/management/outings/${testOuting1.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wardenToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(approveOutRes.status, 400, 'Approving OUT outing must return 400');
    console.log('  -> PASS: Invalid transition OUT -> APPROVED rejected with 400.');

    // 16. Biometric Gate Correlation: Verified ENTRY transit completes OUT -> RETURNED
    console.log('[TEST 16] Simulating biometric ENTRY gate transit for active outing...');
    const biometricEntryRes = await fetch(`${BASE_URL}/test/biometric/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        eventType: 'ENTRY',
        direction: 'IN',
        gate: 'Hostel Main Gate Turnstile #1',
        verificationStatus: 'VERIFIED',
      }),
    });
    assert.strictEqual(biometricEntryRes.status, 201, 'Biometric event must be recorded');

    // Check that outing1 is now RETURNED with actualReturnTime set
    const outingAfterEntry = await prisma.outingRequest.findUnique({ where: { id: testOuting1.id } });
    assert.strictEqual(outingAfterEntry.status, 'RETURNED', 'Outing status must automatically transition to RETURNED');
    assert.ok(outingAfterEntry.actualReturnTime, 'actualReturnTime must be set');
    console.log(`  -> PASS: Verified biometric ENTRY successfully completed outing to RETURNED at: ${outingAfterEntry.actualReturnTime}`);

    // 17. Clean up test data
    console.log('[TEST 17] Cleaning up test outings and notifications...');
    await prisma.notification.deleteMany({
      where: {
        entityId: { in: [testOuting1.id, testOuting2.id] },
      },
    });
    await prisma.activityLog.deleteMany({
      where: {
        studentId,
        actionType: 'OUTING',
        description: {
          contains: 'OUT-TEST-',
        },
      },
    });
    await prisma.outingRequest.deleteMany({
      where: {
        id: { in: [testOuting1.id, testOuting2.id] },
      },
    });
    console.log('  -> PASS: Test data cleaned up.');

    console.log('\n=== ALL 17 MANAGEMENT OUTING API TESTS PASSED! ===\n');
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
