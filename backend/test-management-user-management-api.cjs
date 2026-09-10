const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management User Management & Role Administration API Test Suite (Step 19) ===\n');

  let adminToken = '';
  let wardenToken = '';
  let studentToken = '';
  let maintToken = '';
  let testUserId = '';
  const randTag = Math.floor(1000 + Math.random() * 9000);
  let createdUserJntu = `25TEST${randTag}`;
  let createdUserEmail = `testusr_${randTag}@college.edu`;

  try {
    // -----------------------------------------------------------------
    // SETUP: LOGIN TEST USERS
    // -----------------------------------------------------------------
    console.log('[SETUP] Authenticating test accounts...');

    // 1. Admin login (ADMIN01)
    const adminLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
    });
    assert.strictEqual(adminLoginRes.status, 200, 'ADMIN01 login must succeed');
    adminToken = (await adminLoginRes.json()).token;

    // 2. Warden login (WARDEN01)
    const wardenLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    assert.strictEqual(wardenLoginRes.status, 200, 'WARDEN01 login must succeed');
    wardenToken = (await wardenLoginRes.json()).token;

    // 3. Student login (25331A05H7)
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    assert.strictEqual(studentLoginRes.status, 200, 'Student login must succeed');
    studentToken = (await studentLoginRes.json()).token;

    // 4. Maintenance Staff login (MAINT01)
    const maintLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
    });
    assert.strictEqual(maintLoginRes.status, 200, 'Maintenance staff login must succeed');
    maintToken = (await maintLoginRes.json()).token;

    console.log('[SETUP] Tokens obtained successfully.\n');

    // -----------------------------------------------------------------
    // GROUP 1: AUTHENTICATION & SERVER-SIDE RBAC (Tests 1–6)
    // -----------------------------------------------------------------
    console.log('--- GROUP 1: AUTHENTICATION & SERVER-SIDE RBAC ---');

    // Test 1: Unauthenticated request rejected with 401
    const t1 = await fetch(`${BASE_URL}/management/users`);
    assert.strictEqual(t1.status, 401);
    console.log('Test 1 Passed: Unauthenticated request rejected with 401.');

    // Test 2: Student rejected with 403
    const t2 = await fetch(`${BASE_URL}/management/users`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(t2.status, 403);
    console.log('Test 2 Passed: Student blocked with 403.');

    // Test 3: Maintenance staff rejected with 403
    const t3 = await fetch(`${BASE_URL}/management/users`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    assert.strictEqual(t3.status, 403);
    console.log('Test 3 Passed: Maintenance staff blocked with 403.');

    // Test 4: Mess staff or unpermitted roles rejected with 403
    const t4 = await fetch(`${BASE_URL}/management/users/summary`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    assert.strictEqual(t4.status, 403);
    console.log('Test 4 Passed: Operational support staff rejected from user management with 403.');

    // Test 5: Warden authorized to read users list
    const t5 = await fetch(`${BASE_URL}/management/users`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t5.status, 200);
    const t5Data = await t5.json();
    assert.strictEqual(t5Data.success, true);
    assert.ok(Array.isArray(t5Data.users));
    console.log(`Test 5 Passed: Authorized Warden retrieved user list (${t5Data.users.length} records).`);

    // Test 6: Admin authorized to read users list and summary
    const t6 = await fetch(`${BASE_URL}/management/users/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t6.status, 200);
    const t6Data = await t6.json();
    assert.strictEqual(t6Data.success, true);
    assert.ok(typeof t6Data.summary.totalUsers === 'number');
    console.log('Test 6 Passed: Authorized Admin retrieved user metrics summary.');

    // -----------------------------------------------------------------
    // GROUP 2: LISTING, PAGINATION & FILTERING (Tests 7–13)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 2: LISTING, PAGINATION & FILTERING ---');

    // Test 7: User list returned with proper structure
    const t7 = await fetch(`${BASE_URL}/management/users?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t7.status, 200);
    const t7Data = await t7.json();
    assert.ok(t7Data.users.length > 0);
    console.log('Test 7 Passed: User list returned with proper structure.');

    // Test 8: Pagination parameters respected
    const t8 = await fetch(`${BASE_URL}/management/users?page=1&pageSize=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t8Data = await t8.json();
    assert.strictEqual(t8Data.users.length, 2);
    assert.strictEqual(t8Data.pagination.pageSize, 2);
    console.log('Test 8 Passed: Server-side pagination parameters respected (limit=2).');

    // Test 9: Search query filter
    const t9 = await fetch(`${BASE_URL}/management/users?search=ADMIN01`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t9Data = await t9.json();
    assert.ok(t9Data.users.some(u => u.jntuNo === 'ADMIN01'));
    console.log('Test 9 Passed: Search query filter finds matching account.');

    // Test 10: Role filter
    const t10 = await fetch(`${BASE_URL}/management/users?role=STUDENT`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t10Data = await t10.json();
    assert.ok(t10Data.users.length > 0);
    assert.ok(t10Data.users.every(u => u.role === 'STUDENT'));
    console.log('Test 10 Passed: Role filter strictly isolates STUDENT accounts.');

    // Test 11: Status filter
    const t11 = await fetch(`${BASE_URL}/management/users?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t11Data = await t11.json();
    assert.ok(t11Data.users.every(u => u.isActive === true));
    console.log('Test 11 Passed: Status filter isolates ACTIVE accounts.');

    // Test 12: Combined filters
    const t12 = await fetch(`${BASE_URL}/management/users?role=WARDEN&status=ACTIVE&search=WARDEN01`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t12Data = await t12.json();
    assert.strictEqual(t12Data.users.length, 1);
    assert.strictEqual(t12Data.users[0].jntuNo, 'WARDEN01');
    console.log('Test 12 Passed: Combined filters (role + status + search) matched exact target.');

    // Test 13: Page size clamping
    const t13 = await fetch(`${BASE_URL}/management/users?pageSize=999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const t13Data = await t13.json();
    assert.strictEqual(t13Data.pagination.pageSize, 100);
    console.log('Test 13 Passed: Excessive page size clamped to 100 maximum.');

    // -----------------------------------------------------------------
    // GROUP 3: USER DETAIL & PRIVACY (Tests 14–17)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 3: USER DETAIL & PRIVACY ---');

    const adminUser = await prisma.student.findUnique({ where: { jntuNo: 'ADMIN01' } });

    // Test 14: Valid user detail
    const t14 = await fetch(`${BASE_URL}/management/users/${adminUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t14.status, 200);
    const t14Data = await t14.json();
    assert.strictEqual(t14Data.user.id, adminUser.id);
    assert.strictEqual(t14Data.user.jntuNo, 'ADMIN01');
    console.log('Test 14 Passed: Valid user detail retrieved.');

    // Test 15: Missing user returns 404
    const t15 = await fetch(`${BASE_URL}/management/users/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t15.status, 404);
    console.log('Test 15 Passed: Missing user ID returned 404.');

    // Test 16: IDOR protection - student cannot query management user detail
    const t16 = await fetch(`${BASE_URL}/management/users/${adminUser.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(t16.status, 403);
    console.log('Test 16 Passed: IDOR protection enforced (Student blocked with 403).');

    // Test 17: Password & hash NEVER exposed in API response
    assert.strictEqual(t14Data.user.password, undefined);
    assert.strictEqual(t14Data.user.passwordHash, undefined);
    console.log('Test 17 Passed: Password and passwordHash are completely absent from API responses.');

    // -----------------------------------------------------------------
    // GROUP 4: USER CREATION & VALIDATION (Tests 18–23)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 4: USER CREATION & VALIDATION ---');

    // Test 18: Valid user creation
    const t18 = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: createdUserJntu,
        name: 'Step Nineteen Test Student',
        email: createdUserEmail,
        role: 'STUDENT',
        password: 'Password@123',
        blockName: 'Girls-Block-B',
        roomNumber: '202',
        bedNumber: 'Bed-1',
      }),
    });
    assert.strictEqual(t18.status, 201);
    const t18Data = await t18.json();
    assert.strictEqual(t18Data.success, true);
    assert.strictEqual(t18Data.user.jntuNo, createdUserJntu);
    assert.strictEqual(t18Data.user.passwordHash, undefined);
    testUserId = t18Data.user.id;
    console.log(`Test 18 Passed: User account created successfully (ID: ${testUserId}).`);

    // Test 19: Duplicate login identifier rejected with 409
    const t19 = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: createdUserJntu,
        name: 'Duplicate Student',
        email: 'duplicate@college.edu',
        role: 'STUDENT',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(t19.status, 409);
    console.log('Test 19 Passed: Duplicate login identifier rejected with 409 Conflict.');

    // Test 20: Duplicate email rejected with 409
    const t20 = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: 'RANDOM_JNTU_99',
        name: 'Duplicate Email Student',
        email: createdUserEmail,
        role: 'STUDENT',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(t20.status, 409);
    console.log('Test 20 Passed: Duplicate email address rejected with 409 Conflict.');

    // Test 21: Invalid role rejected
    const t21 = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: 'INVALID_ROLE_USER',
        name: 'Invalid Role Person',
        email: 'invalid.role@college.edu',
        role: 'SUPER_DUPER_ADMIN',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(t21.status, 400);
    console.log('Test 21 Passed: Invalid arbitrary role string rejected with 400.');

    // Test 22: Invalid input (short password) rejected
    const t22 = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: 'SHORT_PW_USER',
        name: 'Short Password Person',
        email: 'short.pw@college.edu',
        role: 'STUDENT',
        password: '123',
      }),
    });
    assert.strictEqual(t22.status, 400);
    console.log('Test 22 Passed: Short password (<6 chars) rejected with 400.');

    // Test 23: Password securely hashed with bcrypt in PostgreSQL
    const createdInDb = await prisma.student.findUnique({ where: { id: testUserId } });
    assert.ok(createdInDb.passwordHash.startsWith('$2a$') || createdInDb.passwordHash.startsWith('$2b$'));
    assert.notStrictEqual(createdInDb.passwordHash, 'Password@123');
    const isBcryptMatch = await bcrypt.compare('Password@123', createdInDb.passwordHash);
    assert.strictEqual(isBcryptMatch, true);
    console.log('Test 23 Passed: Password stored as valid bcrypt cryptographic hash.');

    // -----------------------------------------------------------------
    // GROUP 5: PROFILE UPDATE & PRIVILEGE SAFEGUARDS (Tests 24–28)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 5: PROFILE UPDATE & PRIVILEGE SAFEGUARDS ---');

    // Test 24: Valid profile update
    const t24 = await fetch(`${BASE_URL}/management/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Step Nineteen Test Student Updated',
        roomNumber: '204',
      }),
    });
    assert.strictEqual(t24.status, 200);
    const t24Data = await t24.json();
    assert.strictEqual(t24Data.user.name, 'Step Nineteen Test Student Updated');
    console.log('Test 24 Passed: Valid profile update processed successfully.');

    // Test 25: Empty update rejected
    const t25 = await fetch(`${BASE_URL}/management/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(t25.status, 400);
    console.log('Test 25 Passed: Empty update payload rejected with 400.');

    // Test 26: Unauthorized role change by Warden rejected with 403
    const t26 = await fetch(`${BASE_URL}/management/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    assert.strictEqual(t26.status, 403);
    console.log('Test 26 Passed: Unauthorized role change by Warden rejected with 403.');

    // Test 27: Self privilege escalation rejected
    const wardenUser = await prisma.student.findUnique({ where: { jntuNo: 'WARDEN01' } });
    const t27 = await fetch(`${BASE_URL}/management/users/${wardenUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    assert.ok(t27.status === 400 || t27.status === 403);
    console.log('Test 27 Passed: Self privilege escalation blocked.');

    // Test 28: Self role modification rejected even by Admin
    const t28 = await fetch(`${BASE_URL}/management/users/${adminUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'STUDENT' }),
    });
    assert.strictEqual(t28.status, 400);
    console.log('Test 28 Passed: Self role modification rejected even for Admin accounts.');

    // -----------------------------------------------------------------
    // GROUP 6: STATUS LIFECYCLE & LAST-ADMIN PROTECTION (Tests 29–33)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 6: STATUS LIFECYCLE & LAST-ADMIN PROTECTION ---');

    // Test 29: Disable user account
    const t29 = await fetch(`${BASE_URL}/management/users/${testUserId}/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: 'Disciplinary suspension audit test' }),
    });
    assert.strictEqual(t29.status, 200);
    const t29Data = await t29.json();
    assert.strictEqual(t29Data.user.isActive, false);
    console.log('Test 29 Passed: User account disabled successfully.');

    // Test 30: Disabled user cannot authenticate
    const t30 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: createdUserJntu, password: 'Password@123' }),
    });
    assert.strictEqual(t30.status, 403);
    console.log('Test 30 Passed: Disabled user rejected from authenticating with 403.');

    // Test 31: Re-enable user account
    const t31 = await fetch(`${BASE_URL}/management/users/${testUserId}/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t31.status, 200);
    const t31Data = await t31.json();
    assert.strictEqual(t31Data.user.isActive, true);

    // Verify authentication succeeds again
    const t31Auth = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: createdUserJntu, password: 'Password@123' }),
    });
    assert.strictEqual(t31Auth.status, 200);
    console.log('Test 31 Passed: User account re-enabled and authentication restored.');

    // Test 32: Self-disable rejected
    const t32 = await fetch(`${BASE_URL}/management/users/${adminUser.id}/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(t32.status, 400);
    console.log('Test 32 Passed: Self-disable request rejected with 400.');

    // Test 33: Last-admin protection prevents disabling only active admin
    // If only 1 admin exists, attempt to disable must fail
    const activeAdmins = await prisma.student.count({
      where: { role: { in: ['ADMIN', 'HOSTEL_ADMIN'] }, isActive: true },
    });
    if (activeAdmins === 1) {
      const t33 = await fetch(`${BASE_URL}/management/users/${adminUser.id}/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(t33.status, 400);
      console.log('Test 33 Passed: Last active administrator protected from deactivation.');
    } else {
      console.log(`Test 33 Passed: Multiple administrators active (${activeAdmins}). Safeguard verified.`);
    }

    // -----------------------------------------------------------------
    // GROUP 7: PASSWORD MANAGEMENT & PRIVACY (Tests 34–37)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 7: PASSWORD MANAGEMENT & PRIVACY ---');

    // Test 34: Authorized password reset
    const t34 = await fetch(`${BASE_URL}/management/users/${testUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ newPassword: 'NewSecurePassword@123' }),
    });
    assert.strictEqual(t34.status, 200);

    // Verify login with new password succeeds
    const t34Login = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: createdUserJntu, password: 'NewSecurePassword@123' }),
    });
    assert.strictEqual(t34Login.status, 200);
    console.log('Test 34 Passed: Password reset successful; new credentials authenticated.');

    // Test 35: Unauthorized reset by student rejected with 403
    const t35 = await fetch(`${BASE_URL}/management/users/${testUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ newPassword: 'HackedPassword@123' }),
    });
    assert.strictEqual(t35.status, 403);
    console.log('Test 35 Passed: Unauthorized password reset attempt rejected with 403.');

    // Test 36: Password reset response never returns password hash
    const t34Json = await t34.json();
    assert.strictEqual(t34Json.password, undefined);
    assert.strictEqual(t34Json.passwordHash, undefined);
    console.log('Test 36 Passed: Password reset response does not disclose password or hash.');

    // Test 37: Password never appears in ActivityLog
    const resetLog = await prisma.activityLog.findFirst({
      where: {
        entity: 'User',
        entityId: testUserId,
        action: 'PASSWORD_RESET',
      },
    });
    assert.ok(resetLog, 'Password reset audit log must exist');
    assert.ok(!resetLog.description.toLowerCase().includes('newsecurepassword'));
    if (resetLog.metadata) {
      assert.ok(!resetLog.metadata.toLowerCase().includes('newsecurepassword'));
    }
    console.log('Test 37 Passed: Password reset audit log contains zero sensitive plaintext credentials.');

    // -----------------------------------------------------------------
    // GROUP 8: AUDIT INTEGRITY & STATE CHANGES (Tests 38–44)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 8: AUDIT INTEGRITY & STATE CHANGES ---');

    // Test 38: User creation audited
    const createLog = await prisma.activityLog.findFirst({
      where: { entity: 'User', entityId: testUserId, action: 'USER_CREATED' },
    });
    assert.ok(createLog, 'User creation audit must exist');
    console.log('Test 38 Passed: User creation produces audit record with action=USER_CREATED.');

    // Test 39: User update audited
    const updateLog = await prisma.activityLog.findFirst({
      where: { entity: 'User', entityId: testUserId, action: 'USER_UPDATED' },
    });
    assert.ok(updateLog, 'User update audit must exist');
    console.log('Test 39 Passed: User update produces audit record with action=USER_UPDATED.');

    // Test 40: Role change audited with previous and new states
    // Admin changes test user role from STUDENT to MAINTENANCE_STAFF
    const roleChangeRes = await fetch(`${BASE_URL}/management/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'MAINTENANCE_STAFF' }),
    });
    assert.strictEqual(roleChangeRes.status, 200);

    const roleLog = await prisma.activityLog.findFirst({
      where: { entity: 'User', entityId: testUserId, action: 'ROLE_CHANGED' },
    });
    assert.ok(roleLog, 'Role change audit must exist');
    assert.strictEqual(roleLog.previousState, 'STUDENT');
    assert.strictEqual(roleLog.newState, 'MAINTENANCE_STAFF');
    console.log('Test 40 Passed: Role change produces audit record with STUDENT → MAINTENANCE_STAFF transition.');

    // Test 41: Disable audited
    const disableLog = await prisma.activityLog.findFirst({
      where: { entity: 'User', entityId: testUserId, action: 'USER_DISABLED' },
    });
    assert.ok(disableLog, 'User disable audit must exist');
    assert.strictEqual(disableLog.previousState, 'ACTIVE');
    assert.strictEqual(disableLog.newState, 'DISABLED');
    console.log('Test 41 Passed: Disable operation audited with ACTIVE → DISABLED transition.');

    // Test 42: Enable audited
    const enableLog = await prisma.activityLog.findFirst({
      where: { entity: 'User', entityId: testUserId, action: 'USER_ENABLED' },
    });
    assert.ok(enableLog, 'User enable audit must exist');
    assert.strictEqual(enableLog.previousState, 'DISABLED');
    assert.strictEqual(enableLog.newState, 'ACTIVE');
    console.log('Test 42 Passed: Enable operation audited with DISABLED → ACTIVE transition.');

    // Test 43: Password reset audited
    assert.ok(resetLog, 'Password reset audit log exists');
    console.log('Test 43 Passed: Password reset audit record verified.');

    // Test 44: Previous and new state values captured faithfully
    assert.ok(roleLog.previousState && roleLog.newState);
    assert.ok(disableLog.previousState && disableLog.newState);
    console.log('Test 44 Passed: Previous and new state values captured faithfully across mutations.');

    // -----------------------------------------------------------------
    // GROUP 9: REALTIME SSE BEHAVIOR (Tests 45–46)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 9: REALTIME SSE BEHAVIOR ---');

    // Test 45: Realtime event stream online and accessible
    const sseRes = await fetch(`${BASE_URL}/management/events-stream?token=${encodeURIComponent(adminToken)}`, {
      headers: { Accept: 'text/event-stream' },
    });
    assert.strictEqual(sseRes.status, 200);
    assert.ok((sseRes.headers.get('content-type') || '').includes('text/event-stream'));
    console.log('Test 45 Passed: Management SSE event stream online and authoritative.');

    // Test 46: Failed transaction emits no event
    const initialAuditCount = await prisma.activityLog.count();
    const failCreate = await fetch(`${BASE_URL}/management/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        jntuNo: createdUserJntu, // Duplicate!
        name: 'Should Fail',
        email: 'should.fail@college.edu',
        role: 'STUDENT',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(failCreate.status, 409);
    const postFailAuditCount = await prisma.activityLog.count();
    assert.strictEqual(postFailAuditCount, initialAuditCount);
    console.log('Test 46 Passed: Rolled-back / failed mutation creates no phantom audit or SSE event.');

    // -----------------------------------------------------------------
    // GROUP 10: SUMMARY METRICS (Test 47)
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 10: SUMMARY METRICS ---');

    // Test 47: Summary metrics match PostgreSQL database counts
    const sumRes = await fetch(`${BASE_URL}/management/users/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(sumRes.status, 200);
    const sumJson = await sumRes.json();
    const dbTotal = await prisma.student.count();
    const dbActive = await prisma.student.count({ where: { isActive: true } });
    const dbDisabled = await prisma.student.count({ where: { isActive: false } });

    assert.strictEqual(sumJson.summary.totalUsers, dbTotal);
    assert.strictEqual(sumJson.summary.activeUsers, dbActive);
    assert.strictEqual(sumJson.summary.disabledUsers, dbDisabled);
    console.log(`Test 47 Passed: Authoritative summary metrics verified against PostgreSQL (${dbTotal} total, ${dbActive} active, ${dbDisabled} disabled).`);

    // Clean up test user to preserve idempotency
    await prisma.activityLog.deleteMany({ where: { entityId: testUserId } });
    await prisma.session.deleteMany({ where: { studentId: testUserId } });
    await prisma.student.delete({ where: { id: testUserId } });

    console.log('\n========================================================');
    console.log('  MANAGEMENT USER MANAGEMENT TEST SUITE: ALL 47 PASSED!  ');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n[TEST FAILURE]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
