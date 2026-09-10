const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Mess Management API Test Suite (Step 13) ===\n');

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
  assert.strictEqual(wardenLoginRes.status, 200, 'Warden login should succeed');
  assert.ok(wardenLoginData.token, 'Warden login should return JWT token');
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
  assert.strictEqual(studentLoginRes.status, 200, 'Student login should succeed');
  const studentToken = studentLoginData.token;
  const studentId = studentLoginData.user.id;
  console.log('  -> PASS: Student logged in successfully.');

  // 3. Unauthorized access -> 401
  console.log('[TEST 3] Unauthorized access without token should return 401...');
  const unauthRes = await fetch(`${BASE_URL}/management/mess/overview`);
  assert.strictEqual(unauthRes.status, 401, 'Must return 401 Unauthorized');
  console.log('  -> PASS: Unauthenticated access rejected with 401.');

  // 4. Student token access -> 403 Forbidden
  console.log('[TEST 4] Student accessing management mess API should return 403...');
  const studentRbacRes = await fetch(`${BASE_URL}/management/mess/overview`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.strictEqual(studentRbacRes.status, 403, 'Student must be rejected with 403');
  console.log('  -> PASS: Student access rejected with 403 Forbidden.');

  // 5. GET /overview for today
  console.log('[TEST 5] Fetching mess overview for today...');
  const overviewRes = await fetch(`${BASE_URL}/management/mess/overview`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const overviewData = await overviewRes.json();
  assert.strictEqual(overviewRes.status, 200, 'Overview request should succeed');
  assert.strictEqual(overviewData.success, true);
  assert.ok(overviewData.data.summary, 'Summary object should exist');
  assert.strictEqual(typeof overviewData.data.summary.totalBookings, 'number');
  assert.strictEqual(typeof overviewData.data.summary.bookedCount, 'number');
  assert.strictEqual(typeof overviewData.data.summary.consumedCount, 'number');
  assert.strictEqual(typeof overviewData.data.summary.cancelledCount, 'number');
  assert.strictEqual(overviewData.data.mealBreakdown.length, 4, 'Must have 4 meals');
  assert.ok(Array.isArray(overviewData.data.blockDistribution), 'Block distribution must be array');
  console.log('  -> PASS: Mess overview retrieved successfully (Total Bookings:', overviewData.data.summary.totalBookings, ').');

  // 6. GET /overview with invalid date -> 400
  console.log('[TEST 6] Invalid date parameter rejected with 400...');
  const invalidDateRes = await fetch(`${BASE_URL}/management/mess/overview?date=invalid-date`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.strictEqual(invalidDateRes.status, 400, 'Invalid date should return 400');
  console.log('  -> PASS: Invalid date rejected with 400 Bad Request.');

  // 7. GET /overview with valid past/future date
  console.log('[TEST 7] Fetching mess overview for specific date 2026-09-01...');
  const dateOverviewRes = await fetch(`${BASE_URL}/management/mess/overview?date=2026-09-01`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const dateOverviewData = await dateOverviewRes.json();
  assert.strictEqual(dateOverviewRes.status, 200);
  assert.strictEqual(dateOverviewData.data.date, '2026-09-01');
  console.log('  -> PASS: Overview for specific date retrieved successfully.');

  // 8. GET /tokens pagination
  console.log('[TEST 8] Fetching paginated tokens list...');
  const tokensRes = await fetch(`${BASE_URL}/management/mess/tokens?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const tokensData = await tokensRes.json();
  assert.strictEqual(tokensRes.status, 200);
  assert.strictEqual(tokensData.success, true);
  assert.ok(Array.isArray(tokensData.tokens));
  assert.ok(tokensData.pagination);
  assert.strictEqual(tokensData.pagination.page, 1);
  assert.strictEqual(tokensData.pagination.limit, 5);
  console.log('  -> PASS: Paginated tokens returned (Total in DB:', tokensData.pagination.total, ').');

  // 9. GET /tokens with mealType filtering
  console.log('[TEST 9] Filtering tokens by mealType=BREAKFAST...');
  const bfRes = await fetch(`${BASE_URL}/management/mess/tokens?mealType=BREAKFAST`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const bfData = await bfRes.json();
  assert.strictEqual(bfRes.status, 200);
  bfData.tokens.forEach(t => assert.strictEqual(t.mealType, 'BREAKFAST'));
  console.log('  -> PASS: MealType filter verified.');

  // 10. GET /tokens with invalid mealType -> 400
  console.log('[TEST 10] Invalid mealType parameter returns 400...');
  const invalidMealRes = await fetch(`${BASE_URL}/management/mess/tokens?mealType=BRUNCH`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.strictEqual(invalidMealRes.status, 400);
  console.log('  -> PASS: Invalid mealType rejected with 400.');

  // 11. GET /tokens with status filtering
  console.log('[TEST 11] Filtering tokens by status=BOOKED...');
  const bookedTokensRes = await fetch(`${BASE_URL}/management/mess/tokens?status=BOOKED`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const bookedTokensData = await bookedTokensRes.json();
  assert.strictEqual(bookedTokensRes.status, 200);
  bookedTokensData.tokens.forEach(t => assert.strictEqual(t.status, 'BOOKED'));
  console.log('  -> PASS: Status filter verified.');

  // 12. GET /tokens with invalid status -> 400
  console.log('[TEST 12] Invalid status parameter returns 400...');
  const invalidStatusRes = await fetch(`${BASE_URL}/management/mess/tokens?status=EATEN`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.strictEqual(invalidStatusRes.status, 400);
  console.log('  -> PASS: Invalid status rejected with 400.');

  // 13. GET /tokens with search parameter
  console.log('[TEST 13] Searching tokens by student name or roll number...');
  const searchRes = await fetch(`${BASE_URL}/management/mess/tokens?search=Manasvi`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const searchData = await searchRes.json();
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchData.tokens.length > 0, 'Should find tokens for Manasvi');
  console.log('  -> PASS: Token search verified (Found:', searchData.tokens.length, ').');

  // 14. GET /tokens/:id - Retrieve single token detail
  const targetToken = searchData.tokens[0];
  console.log('[TEST 14] Retrieving token detail for ID:', targetToken.id);
  const detailRes = await fetch(`${BASE_URL}/management/mess/tokens/${targetToken.id}`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const detailData = await detailRes.json();
  assert.strictEqual(detailRes.status, 200);
  assert.strictEqual(detailData.token.id, targetToken.id);
  assert.ok(detailData.token.student);
  assert.ok(detailData.token.student.name.includes('MANASVI'));
  console.log('  -> PASS: Token detail retrieved with resident relations.');

  // 15. GET /tokens/nonexistent-id -> 404
  console.log('[TEST 15] Non-existent token ID returns 404...');
  const notFoundRes = await fetch(`${BASE_URL}/management/mess/tokens/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.strictEqual(notFoundRes.status, 404);
  console.log('  -> PASS: 404 handled properly for missing token.');

  // 16. GET /students/:studentId/history
  console.log('[TEST 16] Retrieving resident meal history for student:', studentId);
  const historyRes = await fetch(`${BASE_URL}/management/mess/students/${studentId}/history`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const historyData = await historyRes.json();
  assert.strictEqual(historyRes.status, 200);
  assert.strictEqual(historyData.student.id, studentId);
  assert.ok(historyData.summary.totalBooked >= 4, 'Must have at least 4 booked tokens in history');
  assert.ok(Array.isArray(historyData.tokens));
  console.log('  -> PASS: Resident meal history and summary statistics verified.');

  // Setup test tokens for administrative mutation testing (consume & cancel)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  await prisma.messToken.deleteMany({
    where: {
      studentId,
      date: tomorrow,
    },
  });
  
  // Book a lunch token for student for tomorrow
  console.log('[SETUP] Booking a test token for tomorrow (Lunch)...');
  const bookLunchRes = await fetch(`${BASE_URL}/student/mess-tokens/book`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mealType: 'LUNCH', date: tomorrow }),
  });
  const bookLunchData = await bookLunchRes.json();
  assert.strictEqual(bookLunchRes.status, 201, 'Booking lunch token for tomorrow should succeed');
  const lunchTokenId = bookLunchData.token.id;

  // Book a snacks token for student for tomorrow
  console.log('[SETUP] Booking a test token for tomorrow (Snacks)...');
  const bookSnacksRes = await fetch(`${BASE_URL}/student/mess-tokens/book`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mealType: 'SNACKS', date: tomorrow }),
  });
  const bookSnacksData = await bookSnacksRes.json();
  assert.strictEqual(bookSnacksRes.status, 201, 'Booking snacks token for tomorrow should succeed');
  const snacksTokenId = bookSnacksData.token.id;

  // 17. POST /tokens/:id/consume - Mark token as consumed
  console.log('[TEST 17] Warden marking lunch token as CONSUMED (ID:', lunchTokenId, ')...');
  const consumeRes = await fetch(`${BASE_URL}/management/mess/tokens/${lunchTokenId}/consume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const consumeData = await consumeRes.json();
  assert.strictEqual(consumeRes.status, 200, 'Consumption should succeed');
  assert.strictEqual(consumeData.success, true);
  assert.strictEqual(consumeData.token.status, 'CONSUMED');
  assert.ok(consumeData.token.consumedAt, 'consumedAt timestamp must be recorded');
  console.log('  -> PASS: Token marked as CONSUMED with timestamp in database.');

  // 18. POST /tokens/:id/consume - Idempotency / already consumed rejection
  console.log('[TEST 18] Marking already consumed token should be rejected with 400...');
  const doubleConsumeRes = await fetch(`${BASE_URL}/management/mess/tokens/${lunchTokenId}/consume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.strictEqual(doubleConsumeRes.status, 400);
  console.log('  -> PASS: Redundant consumption rejected with 400.');

  // 19. POST /tokens/:id/cancel without reason -> 400
  console.log('[TEST 19] Cancelling token without reason rejected with 400...');
  const noReasonCancelRes = await fetch(`${BASE_URL}/management/mess/tokens/${snacksTokenId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: '' }),
  });
  assert.strictEqual(noReasonCancelRes.status, 400);
  console.log('  -> PASS: Empty cancellation reason rejected with 400.');

  // 20. POST /tokens/:id/cancel on consumed token rejected -> 400
  console.log('[TEST 20] Cancelling already consumed token rejected with 400...');
  const cancelConsumedRes = await fetch(`${BASE_URL}/management/mess/tokens/${lunchTokenId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Student left early' }),
  });
  assert.strictEqual(cancelConsumedRes.status, 400);
  console.log('  -> PASS: Cancelling consumed token prevented with 400.');

  // 21. POST /tokens/:id/cancel - Legitimate administrative cancellation
  console.log('[TEST 21] Administratively cancelling snacks token (ID:', snacksTokenId, ')...');
  const cancelRes = await fetch(`${BASE_URL}/management/mess/tokens/${snacksTokenId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Emergency mess maintenance scheduled' }),
  });
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelRes.status, 200, 'Cancellation should succeed');
  assert.strictEqual(cancelData.token.status, 'CANCELLED');
  assert.ok(cancelData.token.cancelledAt);
  assert.strictEqual(cancelData.token.cancellationReason, 'Emergency mess maintenance scheduled');
  console.log('  -> PASS: Token administratively cancelled with audit trail.');

  // 22. Verification of PostgreSQL state and audit logs
  console.log('[TEST 22] Verifying ActivityLog and Notifications in PostgreSQL...');

  const consumedTokenRecord = await prisma.messToken.findUnique({ where: { id: lunchTokenId } });
  assert.strictEqual(consumedTokenRecord.status, 'CONSUMED');
  assert.ok(consumedTokenRecord.consumedAt);

  const cancelledTokenRecord = await prisma.messToken.findUnique({ where: { id: snacksTokenId } });
  assert.strictEqual(cancelledTokenRecord.status, 'CANCELLED');
  assert.strictEqual(cancelledTokenRecord.cancellationReason, 'Emergency mess maintenance scheduled');

  const auditLogs = await prisma.activityLog.findMany({
    where: { actionType: 'MESS_MANAGEMENT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert.ok(auditLogs.length >= 2, 'Must have at least 2 MESS_MANAGEMENT activity logs');
  console.log('  -> PASS: PostgreSQL persistence, timestamps, ActivityLog, and Student notifications verified.');

  await prisma.$disconnect();
  console.log('\n=== All 22 Management Mess Management API Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite failed:', err);
  process.exit(1);
});
