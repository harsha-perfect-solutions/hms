const assert = require('assert');
const http = require('http');

const API_BASE = 'http://localhost:5001/api';

async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJson(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('=== Running Step 10 Management Dashboard API & Security Tests ===\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${total}. ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // 1. Unauthenticated requests must be rejected
  await test('Unauthenticated GET /api/management/dashboard rejected with 401', async () => {
    const res = await getJson('/management/dashboard');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Authentication required/i);
  });

  // 2. Obtain Student Token
  let studentToken = '';
  await test('Student login succeeds at /api/auth/login', async () => {
    const res = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.token, 'Student token required');
    studentToken = res.data.token;
  });

  // 3. Student attempting Management Dashboard must be rejected with 403
  await test('Student role rejected from GET /api/management/dashboard with 403 Forbidden', async () => {
    const res = await getJson('/management/dashboard', studentToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Access denied/i);
  });

  // 4. Student attempting Management Login must be rejected with 403
  await test('Student credentials rejected from POST /api/management/auth/login with 403', async () => {
    const res = await postJson('/management/auth/login', {
      username: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Student accounts cannot access the management portal/i);
  });

  // 5. Invalid credentials rejected
  await test('Invalid management credentials rejected with 401', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'WrongPassword!',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  // 6. Missing identifier or password validation
  await test('Missing username or password rejected with 400', async () => {
    const res1 = await postJson('/management/auth/login', { password: 'Password@123' });
    assert.strictEqual(res1.status, 400);

    const res2 = await postJson('/management/auth/login', { username: 'WARDEN01', password: '' });
    assert.strictEqual(res2.status, 400);
  });

  // 7. Authoritative Warden Login
  let wardenToken = '';
  await test('Valid warden credentials authenticate successfully with 200 and token', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token, 'Warden token must be generated');
    assert.strictEqual(res.data.user.jntuNo, 'WARDEN01');
    assert.strictEqual(res.data.user.role, 'WARDEN');
    wardenToken = res.data.token;
  });

  // 8. Management GET /me
  await test('Warden GET /api/management/auth/me returns authenticated management profile', async () => {
    const res = await getJson('/management/auth/me', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.jntuNo, 'WARDEN01');
    assert.strictEqual(res.data.user.role, 'WARDEN');
  });

  // 9. Fetch Management Dashboard
  let dashboardData = null;
  await test('Authorized warden accesses GET /api/management/dashboard with 200', async () => {
    const res = await getJson('/management/dashboard', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data, 'Dashboard data must exist');
    dashboardData = res.data.data;
  });

  // 10. Verify Resident Presence Metrics
  await test('Dashboard returns authoritative Resident Presence Metrics', async () => {
    const r = dashboardData.residents;
    assert(typeof r.totalResidents === 'number');
    assert(r.totalResidents >= 3, 'At least 3 active students in PostgreSQL');
    assert(r.activeResidents >= 2, 'At least 2 allocated residents in PostgreSQL');
    assert(typeof r.currentlyInside === 'number');
    assert(typeof r.currentlyOutside === 'number');
    assert.strictEqual(r.currentlyInside + r.currentlyOutside, r.totalResidents, 'Inside + outside must match total');
    assert(typeof r.onLeave === 'number');
    assert(typeof r.suspended === 'number');
  });

  // 11. Verify Room Occupancy Metrics
  await test('Dashboard returns authoritative Room Occupancy Metrics from PostgreSQL', async () => {
    const rm = dashboardData.rooms;
    assert(typeof rm.totalRooms === 'number');
    assert(rm.totalRooms >= 2, 'At least 2 distinct rooms in database');
    assert(rm.occupied >= 1, 'At least 1 occupied room (Girls-Block-B 119)');
    assert(rm.vacant >= 1, 'At least 1 vacant room');
    assert(typeof rm.occupancyPercentage === 'number');
    assert(rm.occupancyPercentage >= 0 && rm.occupancyPercentage <= 100);
    assert(rm.totalCapacity >= 4, 'Total capacity computed dynamically');
    assert(rm.allocatedBeds >= 2, 'Allocated beds matches real student occupants');
  });

  // 12. Verify Request Pipeline Metrics
  await test('Dashboard returns authoritative Request Pipeline Metrics', async () => {
    const reqs = dashboardData.requests;
    assert(typeof reqs.pendingOutings === 'number');
    assert(typeof reqs.pendingLeaves === 'number');
    assert(typeof reqs.openComplaints === 'number');
    assert(reqs.openComplaints >= 11, 'At least 11 open complaints in PostgreSQL');
    assert(typeof reqs.actionableTotal === 'number');
    assert.strictEqual(
      reqs.actionableTotal,
      reqs.pendingOutings + reqs.pendingLeaves + reqs.openComplaints
    );
  });

  // 13. Verify Actionable Attention Items
  await test('Dashboard returns categorized Attention Items for actionable conditions', async () => {
    const att = dashboardData.attention;
    assert(Array.isArray(att));
    assert(att.length > 0, 'Attention items must reflect open complaints or pending requests');
    const complaintItem = att.find((i) => i.category === 'COMPLAINT');
    assert(complaintItem, 'Open complaints must produce an attention item');
    assert.strictEqual(complaintItem.targetModule, '/management/maintenance');
    assert.strictEqual(complaintItem.isAvailable, false, 'Unimplemented target module must be marked isAvailable=false');
  });

  // 14. Verify Recent Real Activity
  await test('Dashboard returns recent ActivityLog records with actor and timestamp', async () => {
    const act = dashboardData.recentActivity;
    assert(Array.isArray(act));
    assert(act.length > 0, 'Recent activity must be populated');
    assert(act[0].id && act[0].activityType && act[0].description);
    assert(act[0].timestamp, 'ISO timestamp required');
  });

  // 15. Verify Recent Biometric Events
  await test('Dashboard returns recent BiometricEvent records with gate and student info', async () => {
    const bio = dashboardData.recentBiometricEvents;
    assert(Array.isArray(bio));
    assert(bio.length > 0, 'Recent biometric events must be populated');
    assert(bio[0].eventType && bio[0].verificationStatus && bio[0].student.name);
  });

  // 16. Verify Real-time Management SSE Stream Connection
  await test('GET /api/management/events-stream establishes real-time SSE connection with 200', async () => {
    const res = await fetch(`${API_BASE}/management/events-stream`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('text/event-stream'), 'Content-Type must be text/event-stream');
    res.body?.cancel();
  });

  console.log(`\n====================================================`);
  console.log(`         MANAGEMENT DASHBOARD TESTS PASSED          `);
  console.log(`====================================================`);
  console.log(`Total Passed: ${passed}/${total}`);
}

runTests().catch((err) => {
  console.error('Fatal error running management tests:', err);
  process.exit(1);
});
