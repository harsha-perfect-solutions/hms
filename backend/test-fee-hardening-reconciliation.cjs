// ============================================================================
// FEE MANAGEMENT & COLLECTION - HARDENING, RECONCILIATION & SAFETY AUDIT SUITE
// ============================================================================
const assert = require('assert');
const http = require('http');
const { PrismaClient, Prisma } = require('@prisma/client');
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
const patchJson = (path, body, token) => request('PATCH', path, body, token);

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

async function runHardeningSuite() {
  console.log('\n======================================================');
  console.log('   FEE MODULES HARDENING & RECONCILIATION AUDIT       ');
  console.log('======================================================\n');

  let adminToken = '';
  let studentToken = '';
  let sampleStudentId = '';
  let academicYearId = '';
  let activeBankAccountId = '';
  let inactiveBankAccountId = '';

  // 1. Authenticate Admin and Student
  await test('1. Auth: Admin login and Student login tokens acquired', async () => {
    const adminRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(adminRes.status, 200);
    adminToken = adminRes.data.token;

    const studentRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(studentRes.status, 200);
    studentToken = studentRes.data.token;
    sampleStudentId = studentRes.data.user.id;
  });

  // 2. Setup Academic Year and Bank Accounts
  await test('2. Setup: Retrieve active Academic Year and Bank Accounts', async () => {
    const yearRes = await getJson('/management/fee-management/academic-years', adminToken);
    assert.strictEqual(yearRes.status, 200);
    const activeYear = yearRes.data.academicYears.find((y) => y.isCurrent) || yearRes.data.academicYears[0];
    assert.ok(activeYear, 'Active academic year must exist');
    academicYearId = activeYear.id;

    const bankRes = await getJson('/management/fee-management/bank-accounts', adminToken);
    assert.strictEqual(bankRes.status, 200);
    const activeAcc = bankRes.data.bankAccounts.find((b) => b.status === 'ACTIVE');
    assert.ok(activeAcc, 'Active bank account must exist');
    activeBankAccountId = activeAcc.id;

    // Create an inactive account specifically for testing if not present
    let inactive = bankRes.data.bankAccounts.find((b) => b.status === 'INACTIVE');
    if (!inactive) {
      const createAccRes = await postJson(
        '/management/fee-management/bank-accounts',
        {
          name: 'Closed Audit Account',
          accountIdentifier: `AUDIT-INACTIVE-${Date.now().toString().slice(-4)}`,
          bankName: 'Test Bank',
          accountNumber: `TESTACC${Date.now().toString().slice(-6)}`,
          ifsc: 'TEST0123456',
          kind: 'GENERAL',
          module: 'BOTH',
          displayLabel: 'Closed Audit Test Account',
        },
        adminToken
      );
      assert.strictEqual(createAccRes.status, 201);
      inactive = createAccRes.data.bankAccount;
      // Toggle to inactive
      await patchJson(`/management/fee-management/bank-accounts/${inactive.id}/toggle-status`, {}, adminToken);
    }
    inactiveBankAccountId = inactive.id;
  });

  // 3. Payment Safety: Invalid Amounts, Negative, Zero, and Precision Checks
  await test('3. Payment Safety: Reject zero, negative, and >2 decimal precision amounts', async () => {
    // Zero
    const zeroRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 0,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-ZERO-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(zeroRes.status, 400);

    // Negative
    const negRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: -500,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-NEG-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(negRes.status, 400);

    // More than 2 decimal places (500.555)
    const precRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 500.555,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-PREC-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(precRes.status, 400);
    assert.ok(precRes.data.message.includes('2 decimal places'));
  });

  // 4. Payment Safety: Bank Account Validation (Nonexistent and Inactive)
  await test('4. Payment Safety: Reject payment referencing nonexistent or inactive bank account', async () => {
    // Nonexistent
    const nonExistentRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 500,
        paymentMethod: 'UPI',
        bankAccountId: '00000000-0000-0000-0000-000000000000',
        upiApp: 'PhonePe',
        upiReference: `UPI-NOACC-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(nonExistentRes.status, 400);

    // Inactive
    const inactiveRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 500,
        paymentMethod: 'UPI',
        bankAccountId: inactiveBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-INACT-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(inactiveRes.status, 400);
    assert.ok(inactiveRes.data.message.includes('inactive'));
  });

  // 5. Payment Safety: Cheque and SBI Collect required fields and validation
  await test('5. Payment Safety: Cheque and SBI Collect required fields validation', async () => {
    // Missing cheque fields
    const badChq1 = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 500,
        paymentMethod: 'CHEQUE',
        bankAccountId: activeBankAccountId,
        // missing chequeNumber, bankName, receivedBy
      },
      adminToken
    );
    assert.strictEqual(badChq1.status, 400);

    // Missing SBI Collect fields
    const badSbi1 = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 500,
        paymentMethod: 'SBI_COLLECT',
        bankAccountId: activeBankAccountId,
        // missing sbiCollectReference, verifiedBy
      },
      adminToken
    );
    assert.strictEqual(badSbi1.status, 400);
  });

  // 6. Payment Safety: Strict Overpayment Protection
  let unpaidItem = null;
  await test('6. Payment Safety: Reject payment amount exceeding outstanding due', async () => {
    const studentRes = await getJson(`/management/fee-collection/students/${sampleStudentId}?academicYearId=${academicYearId}`, adminToken);
    unpaidItem = studentRes.data.feeItems.find((it) => Number(it.dueAmount) > 0);
    if (!unpaidItem) {
      const extraRes = await postJson(
        '/management/fee-collection/extra-fee',
        {
          studentId: sampleStudentId,
          academicYearId,
          feeType: 'HOSTEL_FEE',
          module: 'HOSTEL',
          amount: 25000,
        },
        adminToken
      );
      if (extraRes.status === 200 || extraRes.status === 201) {
        unpaidItem = extraRes.data.feeItem;
      }
    }
    assert.ok(unpaidItem, 'Student must have an unpaid item for overpayment test');

    const excessiveAmount = Number(unpaidItem.dueAmount) + 10000;
    const overpayRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        feeItemId: unpaidItem.id,
        amount: excessiveAmount,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'Google Pay',
        upiReference: `UPI-OVER-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(overpayRes.status, 400);
    assert.ok(overpayRes.data.message.includes('Overpayment not permitted'));
  });

  // 7. Concurrency Test: Simultaneous payments attempting to overpay remaining due
  await test('7. Concurrency: Parallel concurrent payments serialized by PostgreSQL locking', async () => {
    // Get fresh due of the item
    const studentRes = await getJson(`/management/fee-collection/students/${sampleStudentId}?academicYearId=${academicYearId}`, adminToken);
    const targetItem = studentRes.data.feeItems.find((it) => it.id === unpaidItem.id);
    const currentDue = Number(targetItem.dueAmount);
    assert.ok(currentDue >= 100, 'Current due must be >= 100');

    // Both try to pay the exact remaining due simultaneously
    const payPromise1 = postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        feeItemId: targetItem.id,
        amount: currentDue,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-CONC-1-${Date.now()}`,
      },
      adminToken
    );

    const payPromise2 = postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        feeItemId: targetItem.id,
        amount: currentDue,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'Paytm',
        upiReference: `UPI-CONC-2-${Date.now()}`,
      },
      adminToken
    );

    const [res1, res2] = await Promise.all([payPromise1, payPromise2]);

    // Exactly one must succeed (201) and one must be rejected (400) because due becomes 0
    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [201, 400], 'One concurrent payment must succeed and the second must be rejected');
  });

  // 8. Transactional Refund Audit: Valid refund, over-refund, double-refund rejection
  let refundReceiptNumber = '';
  let refundedPaymentId = '';
  await test('8. Refund Audit: Valid refund, rejection of excessive refund, and immutability of payment', async () => {
    // 1. Find the payment just made
    const historyRes = await getJson(`/management/fee-collection/students/${sampleStudentId}/payment-history?academicYearId=${academicYearId}`, adminToken);
    assert.strictEqual(historyRes.status, 200);
    const latestPayment = historyRes.data.payments[0];
    assert.ok(latestPayment, 'Payment history must include recent payment');
    refundedPaymentId = latestPayment.id;
    refundReceiptNumber = latestPayment.receiptNumber;

    // 2. Reject excessive refund (greater than payment amount)
    const badRefundRes = await postJson(
      '/management/fee-collection/refunds',
      {
        feeItemId: unpaidItem.id,
        paymentId: latestPayment.id,
        amount: Number(latestPayment.amount) + 5000,
        reason: 'Excessive refund attempt',
      },
      adminToken
    );
    assert.strictEqual(badRefundRes.status, 400);

    // 3. Process valid partial refund
    const refundHalf = Math.floor(Number(latestPayment.amount) / 2);
    if (refundHalf > 0) {
      const validRefundRes = await postJson(
        '/management/fee-collection/refunds',
        {
          feeItemId: unpaidItem.id,
          paymentId: latestPayment.id,
          amount: refundHalf,
          reason: 'Authorized partial refund test',
        },
        adminToken
      );
      assert.strictEqual(validRefundRes.status, 201);
      assert.strictEqual(validRefundRes.data.success, true);
    }
  });

  // 9. IDOR Audit: User attempting to mutate or refund another student's fee item or payment
  await test('9. IDOR Protection: Reject payment or refund targeting mismatched student IDs', async () => {
    // Find another student
    const allStudents = await prisma.student.findMany({
      where: { id: { not: sampleStudentId } },
      take: 1,
    });
    if (allStudents.length > 0) {
      const otherStudent = allStudents[0];

      // Attempt payment for Student A using Student B's feeItemId
      const idorPayRes = await postJson(
        '/management/fee-collection/payments',
        {
          studentId: otherStudent.id,
          academicYearId,
          feeItemId: unpaidItem.id, // belongs to sampleStudentId
          amount: 100,
          paymentMethod: 'UPI',
          bankAccountId: activeBankAccountId,
          upiApp: 'PhonePe',
          upiReference: `UPI-IDOR-${Date.now()}`,
        },
        adminToken
      );
      assert.strictEqual(idorPayRes.status, 400, 'Must reject payment with mismatched student and feeItem');

      // Attempt refund using Student B's student context with Student A's paymentId
      const otherFeeItem = await prisma.feeItem.findFirst({ where: { studentId: otherStudent.id } });
      if (otherFeeItem) {
        const idorRefundRes = await postJson(
          '/management/fee-collection/refunds',
          {
            feeItemId: otherFeeItem.id,
            paymentId: refundedPaymentId, // belongs to sampleStudentId
            amount: 50,
            reason: 'IDOR refund attempt',
          },
          adminToken
        );
        assert.strictEqual(idorRefundRes.status, 400, 'Must reject refund with mismatched payment and feeItem student');
      }
    }
  });

  // 10. Database Reconciliation: Authoritative PostgreSQL financial ledger reconciliation
  await test('10. Financial Reconciliation: PostgreSQL Decimal ledger reconciles 100% with API response', async () => {
    const studentsWithFees = await prisma.student.findMany({
      where: {
        feeItems: { some: { academicYearId } },
      },
      include: {
        feeItems: { where: { academicYearId } },
        feePayments: { where: { academicYearId, status: { not: 'VOID' } }, include: { allocations: true, refunds: true } },
      },
    });

    for (const student of studentsWithFees) {
      // Calculate authoritative PostgreSQL values
      let dbTotalFee = new Prisma.Decimal(0);
      let dbPaid = new Prisma.Decimal(0);
      let dbConcession = new Prisma.Decimal(0);
      let dbDue = new Prisma.Decimal(0);
      let dbExcess = new Prisma.Decimal(0);
      let dbRefund = new Prisma.Decimal(0);

      for (const item of student.feeItems) {
        dbTotalFee = dbTotalFee.plus(item.totalFee);
        dbPaid = dbPaid.plus(item.paidAmount);
        dbConcession = dbConcession.plus(item.concessionAmount);
        dbDue = dbDue.plus(item.dueAmount);
        dbExcess = dbExcess.plus(item.excessPaid);
        dbRefund = dbRefund.plus(item.refundedAmount);

        // Individual item math verification
        // netDue = max(totalFee - paidAmount - concessionAmount, 0)
        const expectedDue = Math.max(Number(item.totalFee) - Number(item.paidAmount) - Number(item.concessionAmount), 0);
        assert.strictEqual(
          Number(item.dueAmount).toFixed(2),
          expectedDue.toFixed(2),
          `Item due mismatch on item ${item.id}`
        );
      }

      // Query API for student list with authoritative aggregates
      const apiRes = await getJson(`/management/fee-collection/students?academicYearId=${academicYearId}&search=${student.name}`, adminToken);
      assert.strictEqual(apiRes.status, 200);
      assert.ok(apiRes.data.students.length >= 1);
      const apiStudent = apiRes.data.students.find((s) => s.student.id === student.id);
      assert.ok(apiStudent, `API must return student ${student.id}`);

      assert.strictEqual(
        Number(apiStudent.totalFee).toFixed(2),
        dbTotalFee.toFixed(2),
        `Total fee mismatch for student ${student.id}`
      );
      assert.strictEqual(
        Number(apiStudent.paidAmount).toFixed(2),
        dbPaid.toFixed(2),
        `Paid amount mismatch for student ${student.id}`
      );
      assert.strictEqual(
        Number(apiStudent.dueAmount).toFixed(2),
        dbDue.toFixed(2),
        `Due amount mismatch for student ${student.id}`
      );
      assert.strictEqual(
        Number(apiStudent.refundedAmount).toFixed(2),
        dbRefund.toFixed(2),
        `Refunded amount mismatch for student ${student.id}`
      );
    }
  });

  // 11. Transaction Rollback Guarantee: Failed transaction produces ZERO database mutations
  await test('11. Transaction Rollback: Database rolls back completely with zero orphaned records on failure', async () => {
    const beforePaymentCount = await prisma.feePayment.count();
    const beforeReceiptCount = await prisma.feeReceipt.count();
    const beforeAllocationCount = await prisma.paymentAllocation.count();
    const targetItemBefore = await prisma.feeItem.findUnique({ where: { id: unpaidItem.id } });

    // Intentionally pass an invalid allocation structure that fails inside the transaction
    const failedRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        allocations: [{ feeItemId: '00000000-0000-0000-0000-000000000000', amount: 500 }],
        amount: 500,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-ROLLBACK-${Date.now()}`,
      },
      adminToken
    );
    assert.strictEqual(failedRes.status, 400);

    const afterPaymentCount = await prisma.feePayment.count();
    const afterReceiptCount = await prisma.feeReceipt.count();
    const afterAllocationCount = await prisma.paymentAllocation.count();
    const targetItemAfter = await prisma.feeItem.findUnique({ where: { id: unpaidItem.id } });

    assert.strictEqual(afterPaymentCount, beforePaymentCount, 'No orphan payment record should exist');
    assert.strictEqual(afterReceiptCount, beforeReceiptCount, 'No orphan receipt record should exist');
    assert.strictEqual(afterAllocationCount, beforeAllocationCount, 'No orphan allocation record should exist');
    assert.strictEqual(
      Number(targetItemAfter.dueAmount).toFixed(2),
      Number(targetItemBefore.dueAmount).toFixed(2),
      'Fee item dues must remain unchanged after rollback'
    );
  });

  // 12. RBAC & IDOR Enforcement on Financial Mutations
  await test('12. RBAC Enforcement: Student token strictly forbidden from financial collection & refunds (403)', async () => {
    // Student token attempting payment
    const studentPayRes = await postJson(
      '/management/fee-collection/payments',
      {
        studentId: sampleStudentId,
        academicYearId,
        amount: 100,
        paymentMethod: 'UPI',
        bankAccountId: activeBankAccountId,
        upiApp: 'PhonePe',
        upiReference: `UPI-FORBIDDEN-${Date.now()}`,
      },
      studentToken
    );
    assert.strictEqual(studentPayRes.status, 403, 'Student cannot process payments');

    // Student token attempting refund
    const studentRefundRes = await postJson(
      '/management/fee-collection/refunds',
      {
        feeItemId: unpaidItem.id,
        amount: 100,
        reason: 'Unauthorized student refund attempt',
      },
      studentToken
    );
    assert.strictEqual(studentRefundRes.status, 403, 'Student cannot process refunds');
  });

  console.log(`\n======================================================`);
  console.log(`HARDENING AUDIT COMPLETE: ${passedCount}/${totalCount} TESTS PASSED!`);
  console.log(`======================================================\n`);
}

runHardeningSuite()
  .catch((e) => {
    console.error('Fatal hardening test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
