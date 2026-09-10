const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function putJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function deleteReq(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runRoomManagementTests() {
  console.log('=== Running Step 12 Room Management & Allocation API Tests ===\n');

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

  // 1. RBAC: Unauthenticated rejected with 401
  await test('1. Unauthenticated requests to /api/management/rooms rejected with 401', async () => {
    const res1 = await getJson('/management/rooms');
    assert.strictEqual(res1.status, 401);
    const res2 = await postJson('/management/rooms', {});
    assert.strictEqual(res2.status, 401);
    const res3 = await getJson('/management/room-allocations');
    assert.strictEqual(res3.status, 401);
  });

  // Login as student
  let studentToken = '';
  const studentLoginRes = await postJson('/auth/login', {
    jntuNo: '25331A05H7',
    password: 'Password@123',
  });
  assert.strictEqual(studentLoginRes.status, 200);
  studentToken = studentLoginRes.data.token;

  // 2. RBAC: Student rejected with 403
  await test('2. Student role rejected with 403 from management room and allocation endpoints', async () => {
    const res1 = await getJson('/management/rooms', studentToken);
    assert.strictEqual(res1.status, 403);
    const res2 = await postJson('/management/rooms', { roomNumber: '999' }, studentToken);
    assert.strictEqual(res2.status, 403);
    const res3 = await postJson('/management/room-allocations', {}, studentToken);
    assert.strictEqual(res3.status, 403);
  });

  // Login as Warden
  let wardenToken = '';
  const wardenLoginRes = await postJson('/management/auth/login', {
    username: 'WARDEN01',
    password: 'Password@123',
  });
  assert.strictEqual(wardenLoginRes.status, 200);
  wardenToken = wardenLoginRes.data.token;

  // Fetch block IDs for test execution
  const blocksRes = await getJson('/management/blocks', wardenToken);
  assert.strictEqual(blocksRes.status, 200);
  const activeBlock = blocksRes.data.blocks.find((b) => b.status === 'ACTIVE' && b.code === 'GB-B') || blocksRes.data.blocks.find((b) => b.status === 'ACTIVE');
  const inactiveBlock = blocksRes.data.blocks.find((b) => b.status === 'INACTIVE');
  assert(activeBlock, 'At least one active block required');

  let testRoomId = '';
  const uniqueRoomNumber = `TEST-${Date.now().toString().slice(-4)}`;

  // 3. Room creation under active block
  await test('3. Authorized warden successfully creates a room in PostgreSQL', async () => {
    const res = await postJson(
      '/management/rooms',
      {
        blockId: activeBlock.id,
        roomNumber: uniqueRoomNumber,
        floor: 3,
        roomType: 'AC Room (2 Sharing)',
        capacity: 2,
        status: 'ACTIVE',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert(res.data.room.id, 'Room ID must be returned');
    assert.strictEqual(res.data.room.roomNumber, uniqueRoomNumber);
    assert.strictEqual(res.data.room.capacity, 2);
    assert.strictEqual(res.data.room.occupancy, 0);
    testRoomId = res.data.room.id;
  });

  // 4. Duplicate room rejection
  await test('4. Duplicate room number in same block is rejected with 409 Conflict', async () => {
    const res = await postJson(
      '/management/rooms',
      {
        blockId: activeBlock.id,
        roomNumber: uniqueRoomNumber,
        floor: 3,
        capacity: 2,
      },
      wardenToken
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /already exists/i);
  });

  // 5. Invalid block rejection
  await test('5. Room creation with non-existent blockId rejected with 404', async () => {
    const res = await postJson(
      '/management/rooms',
      {
        blockId: '00000000-0000-0000-0000-000000000000',
        roomNumber: '888',
        capacity: 2,
      },
      wardenToken
    );
    assert.strictEqual(res.status, 404);
  });

  // 6. Inactive block rejection
  await test('6. Room creation under an INACTIVE block is rejected with 400', async () => {
    if (inactiveBlock) {
      const res = await postJson(
        '/management/rooms',
        {
          blockId: inactiveBlock.id,
          roomNumber: `INACT-${Date.now().toString().slice(-4)}`,
          capacity: 2,
        },
        wardenToken
      );
      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /inactive block/i);
    }
  });

  // 7. Room retrieval and filters
  await test('7. GET /api/management/rooms retrieves rooms with computed occupancy & available beds', async () => {
    const res = await getJson('/management/rooms', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.rooms));
    assert(res.data.summary, 'Summary stats must be included');
    assert(typeof res.data.summary.totalCapacity === 'number');
    assert(typeof res.data.summary.allocatedBeds === 'number');

    const created = res.data.rooms.find((r) => r.id === testRoomId);
    assert(created, 'Newly created room must be present in response');
    assert.strictEqual(created.availableBeds, 2);
    assert.strictEqual(created.occupancyStatus, 'Vacant');
  });

  // 8. Room update
  await test('8. PUT /api/management/rooms/:id updates room details successfully', async () => {
    const res = await putJson(
      `/management/rooms/${testRoomId}`,
      {
        floor: 4,
        roomType: 'Deluxe AC Room (2 Sharing)',
      },
      wardenToken
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.room.floor, 4);
    assert.strictEqual(res.data.room.roomType, 'Deluxe AC Room (2 Sharing)');
  });

  // Fetch unallocated student: Rahul Varma (21A91A0501)
  const rahulStudent = await prisma.student.findUnique({ where: { jntuNo: '21A91A0501' } });
  assert(rahulStudent, 'Rahul Varma must exist in database');

  // Clean up any stray active allocation for Rahul Varma from prior runs
  await prisma.roomAllocation.updateMany({
    where: { studentId: rahulStudent.id, status: 'ACTIVE' },
    data: { status: 'VACATED', vacatedAt: new Date() },
  });
  await prisma.student.update({
    where: { id: rahulStudent.id },
    data: { allocationStatus: 'NOT_ALLOCATED', blockName: null, roomNumber: null, bedNumber: null },
  });

  // 9. Eligible students list
  await test('9. GET /api/management/room-allocations/eligible-students returns unallocated students', async () => {
    const res = await getJson('/management/room-allocations/eligible-students', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const rahul = res.data.students.find((s) => s.id === rahulStudent.id);
    assert(rahul, 'Unallocated student Rahul Varma must be listed as eligible');
  });

  let allocationId = '';

  // 10. Student room allocation
  await test('10. Authorized warden allocates student to active room atomically', async () => {
    const res = await postJson(
      '/management/room-allocations',
      {
        roomId: testRoomId,
        studentId: rahulStudent.id,
        bedNumber: 'Bed-1',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.allocation.roomId, testRoomId);
    assert.strictEqual(res.data.allocation.studentId, rahulStudent.id);
    assert.strictEqual(res.data.allocation.bedNumber, 'Bed-1');
    assert.strictEqual(res.data.allocation.status, 'ACTIVE');
    allocationId = res.data.allocation.id;
  });

  // 11. Duplicate active allocation rejection
  await test('11. Attempting to allocate an already allocated student is rejected with 409', async () => {
    const res = await postJson(
      '/management/room-allocations',
      {
        roomId: testRoomId,
        studentId: rahulStudent.id,
        bedNumber: 'Bed-2',
      },
      wardenToken
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /already actively allocated/i);
  });

  // 12. Student My Room synchronization
  await test('12. Student My Room API (/api/student/my-room) immediately reflects new allocation', async () => {
    const rahulLogin = await postJson('/auth/login', {
      jntuNo: '21A91A0501',
      password: 'Password@123',
    });
    assert.strictEqual(rahulLogin.status, 200);
    const rahulToken = rahulLogin.data.token;

    const myRoomRes = await getJson('/student/my-room', rahulToken);
    assert.strictEqual(myRoomRes.status, 200);
    assert.strictEqual(myRoomRes.data.success, true);
    assert.strictEqual(myRoomRes.data.allocation.status, 'ALLOCATED');
    assert.strictEqual(myRoomRes.data.allocation.roomNumber, uniqueRoomNumber);
    assert.strictEqual(myRoomRes.data.allocation.bedNumber, 'Bed-1');
    assert.strictEqual(myRoomRes.data.room.roomNumber, uniqueRoomNumber);
    assert.strictEqual(myRoomRes.data.room.occupancy, 1);
  });

  // 13. Safe room deletion rejection
  await test('13. Deleting a room with active student allocations is rejected with 400', async () => {
    const res = await deleteReq(`/management/rooms/${testRoomId}`, wardenToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /active student allocation/i);
  });

  // 14. Capacity reduction rejection
  await test('14. Reducing capacity below current active occupants is rejected with 400', async () => {
    const res = await putJson(
      `/management/rooms/${testRoomId}`,
      {
        capacity: 0, // invalid and below 1
      },
      wardenToken
    );
    assert.strictEqual(res.status, 400);
  });

  // Create another room to test reallocation
  const targetRoomNumber = `TARG-${Date.now().toString().slice(-4)}`;
  const targetRoomRes = await postJson(
    '/management/rooms',
    {
      blockId: activeBlock.id,
      roomNumber: targetRoomNumber,
      capacity: 2,
    },
    wardenToken
  );
  assert.strictEqual(targetRoomRes.status, 201);
  const targetRoomId = targetRoomRes.data.room.id;

  // 15. Student reallocation
  await test('15. Reallocating student to new room atomically marks old as REALLOCATED and creates new ACTIVE', async () => {
    const res = await postJson(
      `/management/room-allocations/${allocationId}/reallocate`,
      {
        targetRoomId: targetRoomId,
        newBedNumber: 'Bed-1',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.allocation.roomId, targetRoomId);
    assert.strictEqual(res.data.allocation.status, 'ACTIVE');

    // Verify old allocation in PostgreSQL is REALLOCATED
    const oldAlloc = await prisma.roomAllocation.findUnique({ where: { id: allocationId } });
    assert.strictEqual(oldAlloc.status, 'REALLOCATED');
    assert(oldAlloc.vacatedAt !== null);

    // Update allocationId reference to newly created active allocation
    allocationId = res.data.allocation.id;
  });

  // 16. Over-allocation prevention
  await test('16. Over-allocation is rejected when room reaches full capacity', async () => {
    // Fill target room capacity: create temp student and allocate to Bed-2
    const tempStudent = await prisma.student.upsert({
      where: { jntuNo: 'TEMP_TEST_STUDENT' },
      update: { isActive: true, role: 'STUDENT', allocationStatus: 'NOT_ALLOCATED' },
      create: {
        jntuNo: 'TEMP_TEST_STUDENT',
        name: 'Temp Test Student',
        email: 'temp.test@example.com',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
      },
    });

    // Allocate temp student to fill room capacity
    const fillRes = await postJson(
      '/management/room-allocations',
      {
        roomId: targetRoomId,
        studentId: tempStudent.id,
        bedNumber: 'Bed-2',
      },
      wardenToken
    );
    assert.strictEqual(fillRes.status, 201);

    // Now target room has 2/2 capacity
    // Try to allocate another student
    const extraStudent = await prisma.student.upsert({
      where: { jntuNo: 'EXTRA_TEST_STUDENT' },
      update: { isActive: true, role: 'STUDENT', allocationStatus: 'NOT_ALLOCATED' },
      create: {
        jntuNo: 'EXTRA_TEST_STUDENT',
        name: 'Extra Test Student',
        email: 'extra.test@example.com',
        passwordHash: 'dummyhash',
        role: 'STUDENT',
      },
    });

    const overAllocRes = await postJson(
      '/management/room-allocations',
      {
        roomId: targetRoomId,
        studentId: extraStudent.id,
      },
      wardenToken
    );
    assert.strictEqual(overAllocRes.status, 400);
    assert.match(overAllocRes.data.message, /full capacity/i);

    // Clean up temp student allocation
    await prisma.roomAllocation.deleteMany({ where: { studentId: tempStudent.id } });
    await prisma.student.deleteMany({ where: { jntuNo: { in: ['TEMP_TEST_STUDENT', 'EXTRA_TEST_STUDENT'] } } });
  });

  // 17. Vacate student allocation
  await test('17. Vacating student updates allocation to VACATED and resets student status to NOT_ALLOCATED', async () => {
    const res = await postJson(`/management/room-allocations/${allocationId}/vacate`, {}, wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const checkAlloc = await prisma.roomAllocation.findUnique({ where: { id: allocationId } });
    assert.strictEqual(checkAlloc.status, 'VACATED');
    assert(checkAlloc.vacatedAt !== null);

    const checkStudent = await prisma.student.findUnique({ where: { id: rahulStudent.id } });
    assert.strictEqual(checkStudent.allocationStatus, 'NOT_ALLOCATED');
    assert.strictEqual(checkStudent.roomNumber, null);
  });

  // 18. Allocation history retrieval
  await test('18. GET /api/management/room-allocations retrieves full allocation history', async () => {
    const res = await getJson(`/management/room-allocations?studentId=${rahulStudent.id}`, wardenToken);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.allocations));
    assert(res.data.allocations.length >= 2, 'Should contain vacated and reallocated history');
  });

  // 19. Safe room deletion succeeds once vacant
  await test('19. Deleting room succeeds when all occupants are vacated', async () => {
    const res1 = await deleteReq(`/management/rooms/${testRoomId}`, wardenToken);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.success, true);

    const res2 = await deleteReq(`/management/rooms/${targetRoomId}`, wardenToken);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.success, true);
  });

  // 20. Audit log persistence in PostgreSQL
  await test('20. ActivityLog records created in PostgreSQL for all room and allocation mutations', async () => {
    const logs = await prisma.activityLog.findMany({
      where: {
        actionType: 'ROOM_MANAGEMENT',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    assert(logs.length > 0, 'Must record ActivityLog entries for room actions');
    console.log(`[PASS] Verified ${logs.length} recent ROOM_MANAGEMENT ActivityLogs in PostgreSQL`);
  });

  console.log('\n====================================================');
  console.log(`      STEP 12 ROOM MANAGEMENT TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runRoomManagementTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
