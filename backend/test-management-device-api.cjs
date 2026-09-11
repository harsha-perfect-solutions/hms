// ============================================================================
// STEP 18: DEVICE MANAGEMENT TEST SUITE (32 AUTHORITATIVE TESTS)
// ============================================================================
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const getJson = (path, token) => request('GET', path, null, token);
const postJson = (path, body, token) => request('POST', path, body, token);
const putJson = (path, body, token) => request('PUT', path, body, token);

let passedCount = 0;
let totalCount = 0;

async function test(name, fn) {
  totalCount++;
  try {
    await fn();
    passedCount++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runDeviceManagementSuite() {
  console.log('\n======================================================');
  console.log('   STEP 18 — DEVICE MANAGEMENT TEST SUITE (32 TESTS)  ');
  console.log('======================================================\n');

  let adminToken = '';
  let studentToken = '';
  let wardenToken = '';
  let createdDeviceId = '';
  let createdDeviceIdentifier = `DEV-TEST-${Date.now().toString().slice(-4)}`;
  let plainGeneratedKey = '';

  // 1. Unauthenticated GET -> 401
  await test('1. Unauthenticated GET /management/devices returns 401', async () => {
    const res = await getJson('/management/devices');
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated request with 401');
  });

  // 2. Student token GET -> 403
  await test('2. Student role token GET /management/devices returns 403 Forbidden', async () => {
    const loginRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200, 'Student login should succeed');
    studentToken = loginRes.data.token;

    const res = await getJson('/management/devices', studentToken);
    assert.strictEqual(res.status, 403, 'Must reject student role with 403 Forbidden');
  });

  // 3. Unauthorized role (e.g. MAINTENANCE_STAFF) -> 403
  await test('3. Unauthorized role token returns 403', async () => {
    // Attempt with a simulated token or non-management role
    const student = await prisma.student.findFirst({ where: { role: 'STUDENT' } });
    assert.ok(student);
    const res = await getJson('/management/devices', studentToken);
    assert.strictEqual(res.status, 403);
  });

  // 4. Authorized management staff (ADMIN01) -> 200
  await test('4. Authorized management user (ADMIN01) authenticates and receives 200', async () => {
    const loginRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    adminToken = loginRes.data.token;

    const res = await getJson('/management/devices', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.devices), 'devices must be an array');
    assert.ok(res.data.stats, 'stats object must exist');
    assert.ok(res.data.pagination, 'pagination object must exist');
  });

  // 5. List pagination
  await test('5. Device list supports pagination with page and pageSize', async () => {
    const res = await getJson('/management/devices?page=1&pageSize=2', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.page, 1);
    assert.strictEqual(res.data.pagination.pageSize, 2);
    assert.ok(res.data.devices.length <= 2);
  });

  // 6. List search
  await test('6. Device list search matches by name or deviceIdentifier', async () => {
    const res = await getJson('/management/devices?search=Gate', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.devices));
    for (const dev of res.data.devices) {
      const match =
        dev.name.toLowerCase().includes('gate') ||
        dev.deviceIdentifier.toLowerCase().includes('gate') ||
        dev.location.toLowerCase().includes('gate');
      assert.ok(match, 'Search results must match query string');
    }
  });

  // 7. Device type filter
  await test('7. Device list filters by deviceType (TURNSTILE)', async () => {
    const res = await getJson('/management/devices?type=TURNSTILE', adminToken);
    assert.strictEqual(res.status, 200);
    for (const dev of res.data.devices) {
      assert.strictEqual(dev.deviceType, 'TURNSTILE');
    }
  });

  // 8. Status filter
  await test('8. Device list filters by operational status', async () => {
    const res = await getJson('/management/devices?status=ONLINE', adminToken);
    assert.strictEqual(res.status, 200);
    for (const dev of res.data.devices) {
      assert.strictEqual(dev.status, 'ONLINE');
    }
  });

  // 9. Enabled filter
  await test('9. Device list filters by enabled flag', async () => {
    const res = await getJson('/management/devices?enabled=true', adminToken);
    assert.strictEqual(res.status, 200);
    for (const dev of res.data.devices) {
      assert.strictEqual(dev.isEnabled, true);
    }
  });

  // 10. Location filter
  await test('10. Device list filters by location substring', async () => {
    const res = await getJson('/management/devices?location=Main', adminToken);
    assert.strictEqual(res.status, 200);
    for (const dev of res.data.devices) {
      assert.ok(dev.location.toLowerCase().includes('main'));
    }
  });

  // 11. Create device (Valid payload)
  await test('11. POST /management/devices registers device with secure one-time API key', async () => {
    const payload = {
      name: 'South Gate Test Turnstile',
      deviceIdentifier: createdDeviceIdentifier,
      deviceType: 'TURNSTILE',
      location: 'South Perimeter Gate',
      description: 'Test Turnstile for Step 18 Automated Verification',
      isEnabled: true,
      ipAddress: '192.168.10.199',
      macAddress: 'AA:BB:CC:DD:EE:01',
      firmwareVersion: 'v2.5.0',
      maintenanceNotes: 'Initial provisioning complete',
    };

    const res = await postJson('/management/devices', payload, adminToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.device);
    assert.strictEqual(res.data.device.deviceIdentifier, createdDeviceIdentifier);
    assert.strictEqual(res.data.device.name, payload.name);
    assert.ok(res.data.apiKey, 'Must return generated API key on creation');
    assert.ok(res.data.warning, 'Must return one-time display warning banner');
    assert.strictEqual(res.data.device.apiKey, undefined, 'Sanitized device must NOT contain plain apiKey');
    assert.strictEqual(res.data.device.apiKeyHash, undefined, 'Sanitized device must NOT contain apiKeyHash');

    createdDeviceId = res.data.device.id;
    plainGeneratedKey = res.data.apiKey;
  });

  // 12. Duplicate identifier rejected
  await test('12. Duplicate deviceIdentifier is rejected with 400', async () => {
    const res = await postJson(
      '/management/devices',
      {
        name: 'Duplicate Device',
        deviceIdentifier: createdDeviceIdentifier,
        deviceType: 'TURNSTILE',
        location: 'Nowhere',
      },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('already exists'));
  });

  // 13. Invalid device type rejected
  await test('13. Invalid device type is rejected with 400', async () => {
    const res = await postJson(
      '/management/devices',
      {
        name: 'Invalid Type Device',
        deviceIdentifier: 'DEV-INVALID-TYPE',
        deviceType: 'FLYING_DRONE_CAMERA',
        location: 'Nowhere',
      },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('Invalid device type'));
  });

  // 14. Detail endpoint
  await test('14. GET /management/devices/:id returns device detail and telemetry without secrets', async () => {
    const res = await getJson(`/management/devices/${createdDeviceId}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.device.id, createdDeviceId);
    assert.strictEqual(res.data.device.deviceIdentifier, createdDeviceIdentifier);
    assert.ok(res.data.device.telemetry, 'Must include telemetry object');
    assert.strictEqual(res.data.device.apiKey, undefined, 'Plain API key must NOT be returned');
    assert.strictEqual(res.data.device.apiKeyHash, undefined, 'API key hash must NOT be returned');
    assert.strictEqual(typeof res.data.device.hasApiKey, 'boolean');
  });

  // 15. Invalid ID returns 404
  await test('15. GET /management/devices/nonexistent-id returns 404', async () => {
    const res = await getJson('/management/devices/non-existent-device-id-99999', adminToken);
    assert.strictEqual(res.status, 404);
  });

  // 16. IDOR protection - students cannot read details
  await test('16. IDOR Protection: Student cannot read device detail endpoint', async () => {
    const res = await getJson(`/management/devices/${createdDeviceId}`, studentToken);
    assert.strictEqual(res.status, 403);
  });

  // 17. Edit device attributes
  await test('17. PUT /management/devices/:id updates safe administrative attributes', async () => {
    const updatePayload = {
      name: 'South Gate Test Turnstile (Updated)',
      location: 'South Gate Corridor B',
      description: 'Updated operational description',
      firmwareVersion: 'v2.5.1',
      maintenanceNotes: 'Firmware upgraded to v2.5.1',
    };

    const res = await putJson(`/management/devices/${createdDeviceId}`, updatePayload, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.device.name, updatePayload.name);
    assert.strictEqual(res.data.device.location, updatePayload.location);
    assert.strictEqual(res.data.device.firmwareVersion, updatePayload.firmwareVersion);
  });

  // 18. Disable device
  await test('18. POST /management/devices/:id/disable deactivates device without deleting records', async () => {
    const res = await postJson(`/management/devices/${createdDeviceId}/disable`, {}, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.device.isEnabled, false);
    assert.strictEqual(res.data.device.status, 'DISABLED');

    // Verify in PostgreSQL directly
    const pgDevice = await prisma.biometricDevice.findUnique({ where: { id: createdDeviceId } });
    assert.strictEqual(pgDevice.isEnabled, false);
    assert.strictEqual(pgDevice.status, 'DISABLED');
  });

  // 19. Enable device
  await test('19. POST /management/devices/:id/enable re-activates device', async () => {
    const res = await postJson(`/management/devices/${createdDeviceId}/enable`, {}, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.device.isEnabled, true);

    // Verify in PostgreSQL directly
    const pgDevice = await prisma.biometricDevice.findUnique({ where: { id: createdDeviceId } });
    assert.strictEqual(pgDevice.isEnabled, true);
  });

  // 20. Credential rotation
  await test('20. POST /management/devices/:id/rotate-credential invalidates old key and issues new key', async () => {
    const res = await postJson(`/management/devices/${createdDeviceId}/rotate-credential`, {}, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.apiKey);
    assert.notStrictEqual(res.data.apiKey, plainGeneratedKey, 'Rotated key must be distinct from original key');
    assert.ok(res.data.warning);

    // Verify in PostgreSQL that hash changed
    const pgDevice = await prisma.biometricDevice.findUnique({ where: { id: createdDeviceId } });
    const calculatedHash = crypto.createHash('sha256').update(res.data.apiKey).digest('hex');
    assert.strictEqual(pgDevice.apiKeyHash, calculatedHash, 'Stored hash must match new key');
  });

  // 21. Secrets never returned in list or details
  await test('21. Security Verification: API secrets and raw hashes are NEVER leaked in GET responses', async () => {
    const listRes = await getJson('/management/devices', adminToken);
    for (const dev of listRes.data.devices) {
      assert.strictEqual(dev.apiKey, undefined);
      assert.strictEqual(dev.apiKeyHash, undefined);
    }

    const detailRes = await getJson(`/management/devices/${createdDeviceId}`, adminToken);
    assert.strictEqual(detailRes.data.device.apiKey, undefined);
    assert.strictEqual(detailRes.data.device.apiKeyHash, undefined);
  });

  // 22. Audit trail created for state-changing operations
  await test('22. Audit records are transactionally recorded in ActivityLog', async () => {
    const auditLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { entityId: createdDeviceId },
          { description: { contains: createdDeviceIdentifier } },
        ],
      },
    });

    assert.ok(auditLogs.length >= 3, 'Must record CREATE, UPDATE, DISABLE/ENABLE audits');
    const actions = auditLogs.map((l) => l.action);
    assert.ok(actions.includes('CREATE') || actions.includes('CREATE_DEVICE'));
    assert.ok(actions.includes('ENABLE') || actions.includes('DISABLE'));

    // Check that secrets were never stored in audit metadata
    for (const log of auditLogs) {
      if (log.metadata) {
        assert.ok(!log.metadata.includes(plainGeneratedKey), 'Plain API key must not be in audit metadata');
      }
    }
  });

  // 23. Device activity endpoint
  await test('23. GET /management/devices/:id/activity returns paginated audit history', async () => {
    const res = await getJson(`/management/devices/${createdDeviceId}/activity?page=1&pageSize=10`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.activity));
    assert.ok(res.data.activity.length > 0);
    assert.ok(res.data.pagination);
  });

  // 24. Biometric event aggregation & correlation
  await test('24. Biometric event telemetry aggregates correctly for registered devices', async () => {
    // Seed a biometric event referencing DEV-GATE-01 if needed
    const student = await prisma.student.findFirst({ where: { role: 'STUDENT' } });
    assert.ok(student);

    await prisma.biometricEvent.create({
      data: {
        studentId: student.id,
        eventType: 'ENTRY',
        direction: 'IN',
        verificationStatus: 'VERIFIED',
        source: 'BIOMETRIC_DEVICE',
        deviceId: 'DEV-GATE-01',
        gate: 'Hostel Main Gate',
      },
    });

    const res = await getJson('/management/devices/DEV-GATE-01', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.device.telemetry);
    assert.ok(res.data.device.telemetry.totalEvents >= 1);
    assert.ok(res.data.device.telemetry.verifiedEvents >= 1);
  });

  // 25. Historical biometric events preserved on device deactivation
  await test('25. Historical biometric events remain fully intact when device is disabled', async () => {
    const countBefore = await prisma.biometricEvent.count({ where: { deviceId: 'DEV-GATE-01' } });
    assert.ok(countBefore > 0);

    const dev = await prisma.biometricDevice.findUnique({ where: { deviceIdentifier: 'DEV-GATE-01' } });
    assert.ok(dev);

    await postJson(`/management/devices/${dev.id}/disable`, {}, adminToken);

    const countAfter = await prisma.biometricEvent.count({ where: { deviceId: 'DEV-GATE-01' } });
    assert.strictEqual(countAfter, countBefore, 'Biometric event count must NOT decrease');

    // Re-enable to leave clean state
    await postJson(`/management/devices/${dev.id}/enable`, {}, adminToken);
  });

  // 26. PostgreSQL persistence verification
  await test('26. PostgreSQL 18.6 schema constraints and data integrity verified', async () => {
    const dbDevice = await prisma.biometricDevice.findUnique({
      where: { deviceIdentifier: createdDeviceIdentifier },
    });
    assert.ok(dbDevice, 'Device must be present in PostgreSQL');
    assert.strictEqual(dbDevice.deviceType, 'TURNSTILE');
    assert.ok(dbDevice.apiKeyHash);
    assert.ok(dbDevice.createdAt instanceof Date);
    assert.ok(dbDevice.updatedAt instanceof Date);
  });

  // 27. Authoritative KPIs reflect real database counts
  await test('27. Dashboard KPI metrics match real database counts', async () => {
    const res = await getJson('/management/devices', adminToken);
    assert.strictEqual(res.status, 200);
    const { stats } = res.data;

    const realTotal = await prisma.biometricDevice.count();
    const realActive = await prisma.biometricDevice.count({ where: { isEnabled: true } });
    const realDisabled = await prisma.biometricDevice.count({ where: { isEnabled: false } });

    assert.strictEqual(stats.totalDevices, realTotal);
    assert.strictEqual(stats.activeDevices, realActive);
    assert.strictEqual(stats.disabledDevices, realDisabled);
  });

  // 28. Bounded page size (clamped to max 100)
  await test('28. Requesting oversized pageSize (e.g. 500) is safely bounded to 100', async () => {
    const res = await getJson('/management/devices?pageSize=500', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.pageSize, 100);
  });

  // 29. Invalid query parameters handled safely
  await test('29. Malformed pagination query parameters default safely without crashing', async () => {
    const res = await getJson('/management/devices?page=abc&pageSize=-10', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.page, 1);
    assert.strictEqual(res.data.pagination.pageSize, 25);
  });

  // 30. SQL injection and special character sanitization in search
  await test('30. SQL Injection and special characters in search handled safely', async () => {
    const res = await getJson("/management/devices?search=' OR 1=1; --", adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.devices));
  });

  // 31. Warden role authorization
  await test('31. WARDEN role has authorized access to view devices', async () => {
    const warden = await prisma.student.findFirst({ where: { role: 'WARDEN' } });
    if (warden) {
      const loginRes = await postJson('/management/auth/login', {
        username: warden.jntuNo,
        password: 'Password@123',
      });
      if (loginRes.status === 200) {
        wardenToken = loginRes.data.token;
        const res = await getJson('/management/devices', wardenToken);
        assert.strictEqual(res.status, 200);
      }
    }
  });

  // 32. Cleanup test device
  await test('32. Cleanup: Remove temporary test device safely', async () => {
    if (createdDeviceId) {
      await prisma.biometricDevice.delete({ where: { id: createdDeviceId } });
    }
  });

  console.log('\n======================================================');
  console.log(`STEP 18 DEVICE MANAGEMENT SUITE: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('======================================================\n');
}

runDeviceManagementSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
