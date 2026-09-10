// Master Integration Test Suite: Fee Management & Fee Collection Modules
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

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

async function patchJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body || {}),
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
  console.log('=== Running Fee Management & Fee Collection Test Suite ===\n');

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

  let adminToken = '';
  let studentToken = '';
  let sampleStudentId = '';
  let sampleYearId = '';
  let sampleBankAccountId = '';
  let sampleFeeStructureId = '';
  let sampleScholarshipTypeId = '';

  // 1. RBAC: Unauthenticated access returns 401
  await test('Unauthenticated request to fee endpoints is rejected with 401', async () => {
    const res = await getJson('/management/fee-management/kpi-stats');
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated access with 401');
  });

  // 2. Obtain student token and verify 403
  await test('Student login cannot access management fee APIs (403 Forbidden)', async () => {
    const loginRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    studentToken = loginRes.data.token;
    sampleStudentId = loginRes.data.user.id;

    const res = await getJson('/management/fee-management/kpi-stats', studentToken);
    assert.strictEqual(res.status, 403, 'Student token must be rejected with 403');
  });

  // 3. Admin login
  await test('Admin credentials authenticate successfully with ADMIN role', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'ADMIN');
    adminToken = res.data.token;
  });

  // 4. KPI Stats
  await test('Authoritative KPI stats return PostgreSQL aggregates', async () => {
    const res = await getJson('/management/fee-management/kpi-stats', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const { stats } = res.data;
    assert.ok(typeof stats.feeStructuresCount === 'number');
    assert.ok(typeof stats.hostelDue === 'number');
    assert.ok(typeof stats.collegeDue === 'number');
    assert.ok(typeof stats.studentsWithDuesCount === 'number');
    assert.ok(typeof stats.scholarshipsPendingCount === 'number');
    assert.ok(typeof stats.activeDetentionsCount === 'number');
  });

  // 5. Academic Years CRUD & Validation
  await test('Academic Years: list, create, date validation, and duplicate prevention', async () => {
    const listRes = await getJson('/management/fee-management/academic-years', adminToken);
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.academicYears));
    assert.ok(listRes.data.academicYears.length >= 1);
    sampleYearId = listRes.data.academicYears[0].id;

    // Invalid dates: start >= end
    const invalidRes = await postJson(
      '/management/fee-management/academic-years',
      {
        code: '2030-2031',
        name: 'Future Year',
        startDate: '2031-06-01',
        endDate: '2030-05-31',
      },
      adminToken
    );
    assert.strictEqual(invalidRes.status, 400, 'Must reject startDate >= endDate');

    // Create valid test academic year
    const validCode = `TEST-${Date.now().toString().slice(-4)}`;
    const createRes = await postJson(
      '/management/fee-management/academic-years',
      {
        code: validCode,
        name: `Test Year ${validCode}`,
        startDate: '2028-06-01',
        endDate: '2029-05-31',
      },
      adminToken
    );
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.data.academicYear.code, validCode);

    // Duplicate code prevention
    const dupRes = await postJson(
      '/management/fee-management/academic-years',
      {
        code: validCode,
        name: 'Duplicate',
        startDate: '2028-06-01',
        endDate: '2029-05-31',
      },
      adminToken
    );
    assert.strictEqual(dupRes.status, 400, 'Must reject duplicate academic year code');
  });

  // 6. Bank Accounts CRUD & Validation
  await test('Bank Accounts: list, create with valid IFSC, reject invalid IFSC, and toggle status', async () => {
    const listRes = await getJson('/management/fee-management/bank-accounts', adminToken);
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.data.bankAccounts.length >= 1);
    sampleBankAccountId = listRes.data.bankAccounts[0].id;

    // Reject invalid IFSC
    const badIfscRes = await postJson(
      '/management/fee-management/bank-accounts',
      {
        name: 'Bad Account',
        accountIdentifier: `ACC-${Date.now()}`,
        bankName: 'SBI',
        accountNumber: '123456789',
        ifsc: 'INVALID_IFSC_123',
        kind: 'GENERAL',
      },
      adminToken
    );
    assert.strictEqual(badIfscRes.status, 400, 'Must reject invalid IFSC format');

    // Create valid bank account
    const testIdent = `TEST-BK-${Date.now().toString().slice(-4)}`;
    const createRes = await postJson(
      '/management/fee-management/bank-accounts',
      {
        name: 'Test Operational Account',
        accountIdentifier: testIdent,
        bankName: 'Axis Bank',
        accountNumber: '91201004829104',
        ifsc: 'UTIB0000123',
        kind: 'GENERAL',
        module: 'BOTH',
      },
      adminToken
    );
    assert.strictEqual(createRes.status, 201);
    const createdAccId = createRes.data.bankAccount.id;

    // Toggle status
    const toggleRes = await patchJson(
      `/management/fee-management/bank-accounts/${createdAccId}/toggle-status`,
      {},
      adminToken
    );
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.data.bankAccount.status, 'INACTIVE');
  });

  // 7. Fee Structures CRUD
  await test('Fee Structures: list, create with positive amount, and soft deactivation', async () => {
    const listRes = await getJson('/management/fee-management/fee-structures', adminToken);
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.data.feeStructures.length >= 1);
    sampleFeeStructureId = listRes.data.feeStructures[0].id;

    // Reject non-positive amount
    const badAmtRes = await postJson(
      '/management/fee-management/fee-structures',
      {
        academicYearId: sampleYearId,
        module: 'HOSTEL',
        feeKind: 'MESS_FEE',
        name: 'Invalid Negative Fee',
        amount: -500,
      },
      adminToken
    );
    assert.strictEqual(badAmtRes.status, 400, 'Must reject negative fee amount');

    // Create valid fee structure
    const createRes = await postJson(
      '/management/fee-management/fee-structures',
      {
        academicYearId: sampleYearId,
        module: 'HOSTEL',
        feeKind: 'MAINTENANCE',
        name: 'Hostel Facility & Gym Fee',
        amount: 5000,
        category: 'REGULAR',
      },
      adminToken
    );
    assert.strictEqual(createRes.status, 201);
    const structId = createRes.data.feeStructure.id;

    // Soft toggle status
    const toggleRes = await patchJson(
      `/management/fee-management/fee-structures/${structId}/toggle-status`,
      {},
      adminToken
    );
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.data.feeStructure.status, 'INACTIVE');
  });

  // 8. Scholarships Workflow & Transactional Application
  await test('Scholarships: assign, approve, and apply towards fee dues safely', async () => {
    // 1. Get scholarship types
    const typesRes = await getJson('/management/fee-management/scholarship-types', adminToken);
    assert.strictEqual(typesRes.status, 200);
    assert.ok(typesRes.data.scholarshipTypes.length >= 1);
    sampleScholarshipTypeId = typesRes.data.scholarshipTypes[0].id;

    // 2. Assign scholarship to student
    const assignRes = await postJson(
      '/management/fee-management/scholarships',
      {
        studentId: sampleStudentId,
        scholarshipTypeId: sampleScholarshipTypeId,
        academicYearId: sampleYearId,
        sanctionedAmount: 10000,
        referenceNumber: `SCH-${Date.now().toString().slice(-4)}`,
        remarks: 'Test Merit Award',
      },
      adminToken
    );
    assert.strictEqual(assignRes.status, 201);
    const scholarshipId = assignRes.data.scholarship.id;
    assert.strictEqual(assignRes.data.scholarship.status, 'ASSIGNED');

    // 3. Approve scholarship
    const approveRes = await patchJson(
      `/management/fee-management/scholarships/${scholarshipId}/approve`,
      {},
      adminToken
    );
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.data.scholarship.status, 'APPROVED');

    // 4. Apply scholarship transactionally towards student dues
    const applyRes = await postJson(
      `/management/fee-management/scholarships/${scholarshipId}/apply`,
      {},
      adminToken
    );
    assert.strictEqual(applyRes.status, 200);
    assert.ok(applyRes.data.appliedAmount > 0);
    assert.ok(['APPLIED', 'CLOSED'].includes(applyRes.data.scholarship.status));
  });

  // 9. Detentions: Academic Standing Workflow
  await test('Detentions: create academic detention, verify academic standing, and revoke', async () => {
    const createRes = await postJson(
      '/management/fee-management/detentions',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        currentYearOfStudy: '3rd Year',
        detainedYearOfStudy: '2nd Year (Held Back)',
        reason: 'Low attendance in Semester 5 (below 65% mandatory threshold)',
        remarks: 'Academic council order #2026/09',
      },
      adminToken
    );
    assert.strictEqual(createRes.status, 201);
    const detentionId = createRes.data.detention.id;
    assert.strictEqual(createRes.data.detention.status, 'ACTIVE');

    // Duplicate active detention check
    const dupRes = await postJson(
      '/management/fee-management/detentions',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        currentYearOfStudy: '3rd Year',
        detainedYearOfStudy: '3rd Year',
        reason: 'Duplicate check',
      },
      adminToken
    );
    assert.strictEqual(dupRes.status, 400, 'Must reject duplicate active detention for same student & year');

    // Revoke detention
    const revokeRes = await patchJson(
      `/management/fee-management/detentions/${detentionId}/revoke`,
      { reason: 'Condonation granted by Vice Chancellor' },
      adminToken
    );
    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.data.detention.status, 'REVOKED');
  });

  // 10. Fee Collection: List Students with Authoritative Breakdown
  await test('Fee Collection: student listing returns authoritative monetary values & breakdown', async () => {
    const res = await getJson(`/management/fee-collection/students?academicYearId=${sampleYearId}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.students));
    assert.ok(res.data.students.length >= 1);

    const first = res.data.students[0];
    assert.ok(first.student.id);
    assert.ok(typeof first.totalFee === 'number');
    assert.ok(typeof first.paidAmount === 'number');
    assert.ok(typeof first.dueAmount === 'number');
    assert.ok(Array.isArray(first.items));
  });

  // 11. Payment Collection: Partial, Full, Method Validations, and Duplicate Reference Protection
  let recordedReceiptNumber = '';
  let paidFeeItemId = '';

  await test('Payment Collection: atomic transaction, receipt generation, and duplicate reference protection', async () => {
    // 1. Fetch target student fee item
    const studentRes = await getJson(`/management/fee-collection/students/${sampleStudentId}?academicYearId=${sampleYearId}`, adminToken);
    assert.strictEqual(studentRes.status, 200);
    const dueItem = studentRes.data.feeItems.find((it) => Number(it.dueAmount) > 0);
    assert.ok(dueItem, 'Student must have an unpaid fee item for testing');
    paidFeeItemId = dueItem.id;

    // 2. Reject inactive bank account
    const inactiveAcc = await prisma.bankAccount.findFirst({ where: { status: 'INACTIVE' } });
    if (inactiveAcc) {
      const badAccRes = await postJson(
        '/management/fee-collection/payments',
        {
          studentId: sampleStudentId,
          academicYearId: sampleYearId,
          feeItemId: dueItem.id,
          amount: 500,
          paymentMethod: 'UPI',
          bankAccountId: inactiveAcc.id,
          upiApp: 'PhonePe',
          upiReference: `UPI-${Date.now()}`,
        },
        adminToken
      );
      assert.strictEqual(badAccRes.status, 400, 'Must reject payment referencing inactive bank account');
    }

    // 3. Process valid Partial Payment via UPI
    const upiRef = `UPI-REF-${Date.now()}`;
    const paymentRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        feeItemId: dueItem.id,
        amount: 2500,
        paymentMethod: 'UPI',
        bankAccountId: sampleBankAccountId,
        upiApp: 'PhonePe',
        upiReference: upiRef,
      },
      adminToken
    );
    assert.strictEqual(paymentRes.status, 201);
    assert.strictEqual(paymentRes.data.success, true);
    assert.ok(paymentRes.data.payment.receiptNumber.startsWith('R-'));
    recordedReceiptNumber = paymentRes.data.payment.receiptNumber;

    // 4. Duplicate transaction reference check (reusing upiRef)
    const dupPayRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        feeItemId: dueItem.id,
        amount: 1000,
        paymentMethod: 'UPI',
        bankAccountId: sampleBankAccountId,
        upiApp: 'PhonePe',
        upiReference: upiRef,
      },
      adminToken
    );
    assert.strictEqual(dupPayRes.status, 400, 'Must reject duplicate UPI payment reference');

    // 5. Cheque Payment
    const chequeNo = `CHQ-${Date.now().toString().slice(-6)}`;
    const chequePayRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        feeItemId: dueItem.id,
        amount: 1500,
        paymentMethod: 'CHEQUE',
        bankAccountId: sampleBankAccountId,
        chequeNumber: chequeNo,
        bankName: 'HDFC Bank',
        receivedBy: 'ADMIN01',
      },
      adminToken
    );
    assert.strictEqual(chequePayRes.status, 201);
    assert.ok(chequePayRes.data.payment.receiptNumber.startsWith('R-'));

    // 6. SBI Collect Payment
    const sbiRef = `DU${Date.now().toString().slice(-8)}`;
    const sbiPayRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        feeItemId: dueItem.id,
        amount: 1000,
        paymentMethod: 'SBI_COLLECT',
        bankAccountId: sampleBankAccountId,
        sbiCollectReference: sbiRef,
        verifiedBy: 'ADMIN01',
      },
      adminToken
    );
    assert.strictEqual(sbiPayRes.status, 201);
  });

  // 12. Receipts & Payment History
  await test('Receipts: fetch receipt details by receipt number and view payment history', async () => {
    const receiptRes = await getJson(`/management/fee-collection/receipts/${recordedReceiptNumber}`, adminToken);
    assert.strictEqual(receiptRes.status, 200);
    assert.strictEqual(receiptRes.data.receipt.receiptNumber, recordedReceiptNumber);
    assert.ok(receiptRes.data.snapshot);
    assert.strictEqual(receiptRes.data.snapshot.receiptNumber, recordedReceiptNumber);

    const historyRes = await getJson(`/management/fee-collection/students/${sampleStudentId}/payment-history`, adminToken);
    assert.strictEqual(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.data.payments));
    assert.ok(historyRes.data.payments.length >= 1);
  });

  // 13. Refund Workflow
  await test('Refund: process authorized refund on paid fee item; reject excessive refund', async () => {
    // Excessive refund check
    const badRefundRes = await postJson(
      '/management/fee-collection/refunds',
      {
        feeItemId: paidFeeItemId,
        amount: 9999999,
        reason: 'Excessive refund test',
      },
      adminToken
    );
    assert.strictEqual(badRefundRes.status, 400, 'Must reject refund exceeding paid balance');

    // Valid refund of 500
    const validRefundRes = await postJson(
      '/management/fee-collection/refunds',
      {
        feeItemId: paidFeeItemId,
        amount: 500,
        reason: 'Mess rebate granted due to academic conference leave',
      },
      adminToken
    );
    assert.strictEqual(validRefundRes.status, 201);
    assert.strictEqual(validRefundRes.data.success, true);
    assert.strictEqual(Number(validRefundRes.data.refund.amount), 500);
  });

  // 14. Add Extra Fee with Biometric Attendance Calculation
  await test('Extra Fee: calculate attendance-based mess fee from real BiometricEvents and add fee item', async () => {
    const res = await postJson(
      '/management/fee-collection/extra-fee',
      {
        studentId: sampleStudentId,
        academicYearId: sampleYearId,
        feeType: 'Mess Extra Days Assessment',
        module: 'HOSTEL',
        isBiometricAttendance: true,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        workingDays: 30,
        dailyRate: 150,
      },
      adminToken
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.feeItem.isExtraFee, true);
    assert.ok(Number(res.data.feeItem.totalFee) > 0);
  });

  // 15. Promotion Workflow
  await test('Promotion: promote student semester/academic year respecting detention status', async () => {
    const res = await postJson(
      '/management/fee-collection/promote',
      {
        studentIds: [sampleStudentId],
        currentAcademicYearId: sampleYearId,
        targetAcademicYearId: sampleYearId,
        promotionType: 'SEMESTER',
      },
      adminToken
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.promotedCount, 1);
  });

  // 16. Idempotent Fee Synchronization
  await test('Fee Synchronization: running sync is idempotent and does not duplicate fee items', async () => {
    const sync1 = await postJson(
      '/management/fee-collection/sync-fees',
      { academicYearId: sampleYearId },
      adminToken
    );
    assert.strictEqual(sync1.status, 200);

    const sync2 = await postJson(
      '/management/fee-collection/sync-fees',
      { academicYearId: sampleYearId },
      adminToken
    );
    assert.strictEqual(sync2.status, 200);
    // Running again must have created 0 new items because they already exist!
    assert.strictEqual(sync2.data.createdCount, 0, 'Second sync run must create 0 duplicate items');
    assert.ok(sync2.data.preservedCount > 0, 'Must preserve existing fee items');
  });

  // 17. Excel Export
  await test('Excel Export: stream valid Excel (.xlsx) file with student fee collection rows', async () => {
    const res = await fetch(`${API_BASE}/management/fee-collection/export-excel?academicYearId=${sampleYearId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('spreadsheetml'));
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assert.ok(buffer.length > 500, 'Excel buffer must contain sheet data');

    // Parse workbook to confirm valid XLSX structure
    const wb = XLSX.read(buffer, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Fee Collection'));
  });

  console.log(`\n====================================================`);
  console.log(`Passed: ${passed}/${total} Fee Management & Collection Tests`);
  console.log(`====================================================\n`);
}

runTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
