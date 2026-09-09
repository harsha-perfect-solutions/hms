const assert = require('assert');

async function testOutingApi() {
  console.log('=== Running Student Hostel Outing Requests API Tests ===\n');

  // 1. Authenticate as MANI MANASVI GAVARA (Allocated student)
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  const manasviToken = loginData.token;

  // 2. Unauthenticated request to /api/student/outing-requests must return 401
  const unauthRes = await fetch('http://localhost:5001/api/student/outing-requests');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('[PASS] 1. Unauthenticated request to /api/student/outing-requests rejected with 401');

  // 3. Authenticated request to /api/student/outing-requests
  const authRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200, 'Authenticated request must return 200');
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.student.jntuNo, '25331A05H7');
  assert.strictEqual(authData.summary.currentStatus, 'In Hostel');
  assert.strictEqual(authData.summary.monthlyLimit, 5);
  console.log('[PASS] 2. Authenticated student receives accurate initial outing state:', authData.summary);

  // 4. Validation tests
  const now = Date.now();
  const futureExit = new Date(now + 2 * 3600 * 1000).toISOString();
  const futureReturn = new Date(now + 5 * 3600 * 1000).toISOString();
  const pastExit = new Date(now - 24 * 3600 * 1000).toISOString();

  // 4a. Missing destination
  const noDestRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      purpose: 'Visiting local bookstore',
      outDate: futureExit,
      returnDate: futureReturn,
    }),
  });
  assert.strictEqual(noDestRes.status, 400, 'Missing destination must return 400');
  console.log('[PASS] 3. Missing destination rejected with 400');

  // 4b. Missing purpose
  const noPurposeRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Central Mall',
      purpose: 'Hi', // too short (<5 chars)
      outDate: futureExit,
      returnDate: futureReturn,
    }),
  });
  assert.strictEqual(noPurposeRes.status, 400, 'Short purpose must return 400');
  console.log('[PASS] 4. Invalid purpose rejected with 400');

  // 4c. Return time before exit time
  const invalidTimeRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Central Mall',
      purpose: 'Purchasing project materials',
      outDate: futureReturn,
      returnDate: futureExit, // Return is before exit!
    }),
  });
  assert.strictEqual(invalidTimeRes.status, 400, 'Return before exit time must return 400');
  console.log('[PASS] 5. Return time prior to exit time rejected with 400');

  // 4d. Outing exit time in the past
  const pastRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Central Mall',
      purpose: 'Purchasing project materials',
      outDate: pastExit,
      returnDate: futureReturn,
    }),
  });
  assert.strictEqual(pastRes.status, 400, 'Past exit time must return 400');
  console.log('[PASS] 6. Past exit date rejected with 400');

  // 5. Valid Outing Request Creation
  const validRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Central Library & Tech Hub',
      purpose: 'Research reference materials for academic assignment',
      emergencyContact: '9876543210',
      outDate: futureExit,
      returnDate: futureReturn,
      status: 'APPROVED', // Client privilege escalation attempt! Must be forced to PENDING
    }),
  });
  const validData = await validRes.json();
  assert.strictEqual(validRes.status, 201, 'Valid creation must return 201 Created');
  assert.strictEqual(validData.success, true);
  assert.strictEqual(validData.request.status, 'PENDING', 'Privilege tamper prevented: must remain PENDING');
  assert(validData.request.requestNumber.startsWith('OUT-'), 'Request number must start with OUT-');
  assert.strictEqual(validData.request.destination, 'Central Library & Tech Hub');
  const createdRequestId = validData.request.id;
  console.log('[PASS] 7. Valid outing request created with server-enforced PENDING status:', validData.request.requestNumber);

  // 6. Conflict prevention: attempt to create another request while one is PENDING
  const conflictRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Market',
      purpose: 'Buying fruits and groceries',
      outDate: futureExit,
      returnDate: futureReturn,
    }),
  });
  assert.strictEqual(conflictRes.status, 409, 'Concurrent active/pending request must be rejected with 409 Conflict');
  const conflictData = await conflictRes.json();
  console.log('[PASS] 8. Conflicting request rejected with 409 Conflict:', conflictData.message);

  // 7. Authorization & IDOR check: Student 2 attempts to cancel Student 1's request
  const student2Login = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
  });
  const student2Data = await student2Login.json();
  const student2Token = student2Data.token;

  const idorCancelRes = await fetch(`http://localhost:5001/api/student/outing-requests/${createdRequestId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  assert.strictEqual(idorCancelRes.status, 403, 'Cancelling another student request must be rejected with 403');
  console.log('[PASS] 9. IDOR protection verified: Student B cannot cancel Student A request (403 Forbidden)');

  // 8. Student 1 cancels their own pending request
  const cancelRes = await fetch(`http://localhost:5001/api/student/outing-requests/${createdRequestId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  assert.strictEqual(cancelRes.status, 200, 'Cancelling own pending request must return 200');
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelData.request.status, 'CANCELLED');
  console.log('[PASS] 10. Student successfully cancelled own pending request');

  // 9. Attempt to cancel already cancelled request
  const repeatCancelRes = await fetch(`http://localhost:5001/api/student/outing-requests/${createdRequestId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  assert.strictEqual(repeatCancelRes.status, 400, 'Cancelling non-pending request must return 400');
  console.log('[PASS] 11. Repeat cancellation rejected with 400');

  // 10. Unallocated student check (Rahul Varma)
  const rahulLogin = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '21A91A0501', password: 'Password@123' }),
  });
  const rahulData = await rahulLogin.json();
  const rahulToken = rahulData.token;

  const rahulCreateRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rahulToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'City Center',
      purpose: 'General shopping and essentials',
      outDate: futureExit,
      returnDate: futureReturn,
    }),
  });
  assert.strictEqual(rahulCreateRes.status, 403, 'Unallocated student must be rejected with 403');
  console.log('[PASS] 12. Unallocated student cannot submit outing request (403 Forbidden)');

  console.log('\nAll Outing Requests API Tests Passed Successfully!');
}

testOutingApi().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
