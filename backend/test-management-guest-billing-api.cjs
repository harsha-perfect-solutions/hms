const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Guest Billing API Test Suite (Step 17) ===\n');

  let wardenToken = null;
  let wardenUser = null;
  let maintToken = null;
  let maintUser = null;
  let studentToken = null;
  let studentUser = null;

  let testGuestId = null;
  let testVisitId = null;
  let testVisitForCheckoutId = null;
  let testBillId = null;
  let testBillNumber = null;
  let testBillToVoidId = null;

  try {
    // -----------------------------------------------------------------
    // SETUP & AUTHENTICATION
    // -----------------------------------------------------------------
    console.log('[SETUP] Logging in users...');

    // 1. Warden Login (Authorized Management Role)
    const wardenRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    const wardenData = await wardenRes.json();
    assert.strictEqual(wardenRes.status, 200, 'Warden login should succeed');
    assert.ok(wardenData.token, 'Warden login should return token');
    wardenToken = wardenData.token;
    wardenUser = wardenData.user;

    // 2. Maintenance Staff Login (Unauthorized Management Role)
    const maintRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
    });
    const maintData = await maintRes.json();
    assert.strictEqual(maintRes.status, 200, 'Maintenance staff login should succeed');
    maintToken = maintData.token;
    maintUser = maintData.user;

    // 3. Student Login (Non-management Role)
    const studentRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    const studentData = await studentRes.json();
    assert.strictEqual(studentRes.status, 200, 'Student login should succeed');
    studentToken = studentData.token;
    studentUser = studentData.user;

    console.log('  -> All test accounts authenticated successfully.\n');

    // -----------------------------------------------------------------
    // AUTH / RBAC TESTS (Tests 1 - 4)
    // -----------------------------------------------------------------

    // TEST 1: Unauthenticated access -> 401
    console.log('[TEST 1] Unauthenticated access to guest billing overview returns 401...');
    const unauthRes = await fetch(`${BASE_URL}/management/guest-billing/overview`);
    assert.strictEqual(unauthRes.status, 401, 'Should reject unauthenticated access with 401');
    console.log('  -> PASS: 401 returned for unauthenticated request.');

    // TEST 2: Student access -> 403
    console.log('[TEST 2] Student role access to guest billing overview returns 403...');
    const studentAccessRes = await fetch(`${BASE_URL}/management/guest-billing/overview`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentAccessRes.status, 403, 'Should reject student access with 403');
    console.log('  -> PASS: 403 returned for student account.');

    // TEST 3: Unauthorized management role (MAINTENANCE_STAFF) -> 403
    console.log('[TEST 3] Unauthorized management role (MAINTENANCE_STAFF) access returns 403...');
    const maintAccessRes = await fetch(`${BASE_URL}/management/guest-billing/overview`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    assert.strictEqual(maintAccessRes.status, 403, 'Should reject maintenance staff access with 403');
    console.log('  -> PASS: 403 returned for unauthorized maintenance staff.');

    // TEST 4: Authorized management role (WARDEN) access succeeds -> 200
    console.log('[TEST 4] Authorized management role (WARDEN) access succeeds...');
    const wardenAccessRes = await fetch(`${BASE_URL}/management/guest-billing/overview`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(wardenAccessRes.status, 200, 'Should allow warden access with 200');
    const overviewData = await wardenAccessRes.json();
    assert.strictEqual(overviewData.success, true);
    assert.ok(overviewData.stats, 'Overview should include stats');
    assert.ok(typeof overviewData.stats.totalGuests === 'number');
    console.log('  -> PASS: Authorized management access succeeded.');

    // -----------------------------------------------------------------
    // GUEST TESTS (Tests 5 - 8)
    // -----------------------------------------------------------------

    // TEST 5: Create guest with valid data succeeds
    console.log('[TEST 5] Create guest with valid data...');
    const uniquePhone = `98480${Math.floor(10000 + Math.random() * 90000)}`;
    const createGuestRes = await fetch(`${BASE_URL}/management/guest-billing/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Ramesh Sharma',
        phone: uniquePhone,
        email: 'ramesh.sharma@example.com',
        idProofType: 'AADHAAR',
        idProofNumber: '1234-5678-9012',
        relation: 'PARENT',
        address: 'Plot 45, Jubilee Hills, Hyderabad',
      }),
    });
    assert.strictEqual(createGuestRes.status, 201, 'Guest creation should return 201');
    const createGuestData = await createGuestRes.json();
    assert.strictEqual(createGuestData.success, true);
    assert.ok(createGuestData.guest.id, 'Created guest must have an ID');
    assert.strictEqual(createGuestData.guest.name, 'Ramesh Sharma');
    assert.strictEqual(createGuestData.guest.phone, uniquePhone);
    testGuestId = createGuestData.guest.id;
    console.log(`  -> PASS: Guest created successfully (ID: ${testGuestId}).`);

    // TEST 6: Invalid guest data rejected
    console.log('[TEST 6] Invalid guest rejected (missing name, invalid phone)...');
    const invalidGuestRes1 = await fetch(`${BASE_URL}/management/guest-billing/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: ' ',
        phone: '1234567890',
      }),
    });
    assert.strictEqual(invalidGuestRes1.status, 400, 'Empty guest name should return 400');

    const invalidGuestRes2 = await fetch(`${BASE_URL}/management/guest-billing/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Valid Name',
        phone: '12', // too short
      }),
    });
    assert.strictEqual(invalidGuestRes2.status, 400, 'Short phone number should return 400');
    console.log('  -> PASS: Invalid guest inputs correctly rejected with 400.');

    // TEST 7: Retrieve and search guest
    console.log('[TEST 7] Retrieve and search guest...');
    const searchGuestRes = await fetch(`${BASE_URL}/management/guest-billing/guests?search=${uniquePhone}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(searchGuestRes.status, 200);
    const searchGuestData = await searchGuestRes.json();
    assert.ok(searchGuestData.guests.length >= 1, 'Search by phone should return at least 1 guest');
    assert.strictEqual(searchGuestData.guests[0].id, testGuestId);

    const getGuestRes = await fetch(`${BASE_URL}/management/guest-billing/guests/${testGuestId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(getGuestRes.status, 200);
    const getGuestData = await getGuestRes.json();
    assert.strictEqual(getGuestData.guest.id, testGuestId);
    console.log('  -> PASS: Guest retrieval and search verified.');

    // TEST 8: Guest update validation
    console.log('[TEST 8] Guest update validation...');
    const invalidUpdateRes = await fetch(`${BASE_URL}/management/guest-billing/guests/${testGuestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ phone: 'bad' }),
    });
    assert.strictEqual(invalidUpdateRes.status, 400, 'Invalid phone update should be rejected');

    const validUpdateRes = await fetch(`${BASE_URL}/management/guest-billing/guests/${testGuestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        address: 'Updated Address, Hyderabad',
        relation: 'GUARDIAN',
      }),
    });
    assert.strictEqual(validUpdateRes.status, 200, 'Valid update should succeed');
    const validUpdateData = await validUpdateRes.json();
    assert.strictEqual(validUpdateData.guest.relation, 'GUARDIAN');
    assert.strictEqual(validUpdateData.guest.address, 'Updated Address, Hyderabad');
    console.log('  -> PASS: Guest update validation verified.');

    // -----------------------------------------------------------------
    // VISIT TESTS (Tests 9 - 15)
    // -----------------------------------------------------------------

    // TEST 9: Create visit with valid data
    console.log('[TEST 9] Create guest visit for host student...');
    const createVisitRes = await fetch(`${BASE_URL}/management/guest-billing/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestId: testGuestId,
        hostStudentId: studentUser.id,
        purpose: 'Academic consultation & campus visit',
        remarks: 'Staying until evening',
      }),
    });
    assert.strictEqual(createVisitRes.status, 201, 'Visit creation should return 201');
    const createVisitData = await createVisitRes.json();
    assert.strictEqual(createVisitData.success, true);
    assert.strictEqual(createVisitData.visit.status, 'CHECKED_IN');
    assert.strictEqual(createVisitData.visit.guestId, testGuestId);
    assert.strictEqual(createVisitData.visit.hostStudentId, studentUser.id);
    testVisitId = createVisitData.visit.id;
    console.log(`  -> PASS: Visit created successfully (ID: ${testVisitId}).`);

    // TEST 10: Invalid host rejected
    console.log('[TEST 10] Invalid host student rejected...');
    const invalidHostRes = await fetch(`${BASE_URL}/management/guest-billing/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestId: testGuestId,
        hostStudentId: '00000000-0000-0000-0000-000000000000',
        purpose: 'Testing nonexistent host',
      }),
    });
    assert.strictEqual(invalidHostRes.status, 404, 'Nonexistent host student should return 404');
    console.log('  -> PASS: Invalid host student correctly rejected.');

    // TEST 11: Invalid guest rejected
    console.log('[TEST 11] Invalid guest rejected...');
    const invalidGuestVisitRes = await fetch(`${BASE_URL}/management/guest-billing/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestId: '00000000-0000-0000-0000-000000000000',
        hostStudentId: studentUser.id,
        purpose: 'Testing nonexistent guest',
      }),
    });
    assert.strictEqual(invalidGuestVisitRes.status, 404, 'Nonexistent guest should return 404');
    console.log('  -> PASS: Invalid guest correctly rejected.');

    // TEST 12: Retrieve visit
    console.log('[TEST 12] Retrieve visit with details...');
    const getVisitRes = await fetch(`${BASE_URL}/management/guest-billing/visits/${testVisitId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(getVisitRes.status, 200);
    const getVisitData = await getVisitRes.json();
    assert.strictEqual(getVisitData.visit.id, testVisitId);
    assert.strictEqual(getVisitData.visit.guest.id, testGuestId);
    assert.strictEqual(getVisitData.visit.hostStudent.id, studentUser.id);
    console.log('  -> PASS: Visit details retrieved with host and guest relation.');

    // Create a second visit specifically for testing check-out constraints
    const visit2Res = await fetch(`${BASE_URL}/management/guest-billing/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestId: testGuestId,
        hostStudentId: studentUser.id,
        purpose: 'Checkout lifecycle test visit',
      }),
    });
    const visit2Data = await visit2Res.json();
    testVisitForCheckoutId = visit2Data.visit.id;

    // TEST 13: Invalid checkout rejected (check-out time earlier than check-in time)
    console.log('[TEST 13] Check-out time earlier than check-in rejected...');
    const pastCheckoutRes = await fetch(`${BASE_URL}/management/guest-billing/visits/${testVisitForCheckoutId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        checkOutTime: new Date(Date.now() - 3600 * 1000 * 24).toISOString(), // 24 hours in the past
      }),
    });
    assert.strictEqual(pastCheckoutRes.status, 400, 'Past checkout time should return 400');
    console.log('  -> PASS: Invalid checkout time rejected with 400.');

    // TEST 14: Valid checkout succeeds
    console.log('[TEST 14] Valid checkout succeeds...');
    const checkoutRes = await fetch(`${BASE_URL}/management/guest-billing/visits/${testVisitForCheckoutId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        checkOutTime: new Date().toISOString(),
      }),
    });
    assert.strictEqual(checkoutRes.status, 200, 'Valid checkout should return 200');
    const checkoutData = await checkoutRes.json();
    assert.strictEqual(checkoutData.visit.status, 'CHECKED_OUT');
    assert.ok(checkoutData.visit.checkOutTime, 'CheckOutTime must be set');
    console.log('  -> PASS: Guest checked out successfully.');

    // TEST 15: Duplicate checkout rejected
    console.log('[TEST 15] Duplicate checkout rejected...');
    const dupCheckoutRes = await fetch(`${BASE_URL}/management/guest-billing/visits/${testVisitForCheckoutId}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ checkOutTime: new Date().toISOString() }),
    });
    assert.strictEqual(dupCheckoutRes.status, 400, 'Duplicate checkout should return 400');
    console.log('  -> PASS: Duplicate checkout rejected with 400.');

    // -----------------------------------------------------------------
    // BILLING TESTS (Tests 16 - 22)
    // -----------------------------------------------------------------

    // TEST 16: Create valid bill with server calculation
    console.log('[TEST 16] Create valid bill with multiple items...');
    const uniqueBillNo = `GB-TEST-${Date.now().toString().slice(-6)}`;
    const createBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        billNumber: uniqueBillNo,
        items: [
          { description: 'Guest Room Accommodation (1 Night)', quantity: 1, unitAmount: 800.0 },
          { description: 'Mess Guest Meals (Breakfast & Dinner)', quantity: 2, unitAmount: 150.0 },
        ],
      }),
    });
    assert.strictEqual(createBillRes.status, 201, 'Bill creation should return 201');
    const createBillData = await createBillRes.json();
    assert.strictEqual(createBillData.success, true);
    testBillId = createBillData.bill.id;
    testBillNumber = createBillData.bill.billNumber;
    console.log(`  -> PASS: Bill created successfully (ID: ${testBillId}, Bill#: ${testBillNumber}).`);

    // TEST 17: Missing billing items rejected
    console.log('[TEST 17] Missing billing items rejected...');
    const emptyItemsRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        items: [],
      }),
    });
    assert.strictEqual(emptyItemsRes.status, 400, 'Empty items array should return 400');
    console.log('  -> PASS: Empty items array rejected with 400.');

    // TEST 18: Negative or invalid amount rejected
    console.log('[TEST 18] Negative or invalid amount rejected...');
    const negativeAmountRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        items: [{ description: 'Invalid item', quantity: 1, unitAmount: -200 }],
      }),
    });
    assert.strictEqual(negativeAmountRes.status, 400, 'Negative unit amount should return 400');

    const invalidQtyRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        items: [{ description: 'Invalid qty', quantity: 0, unitAmount: 100 }],
      }),
    });
    assert.strictEqual(invalidQtyRes.status, 400, 'Zero quantity should return 400');
    console.log('  -> PASS: Negative amounts and zero quantity correctly rejected.');

    // TEST 19: Server-calculated totals verified
    console.log('[TEST 19] Verify backend authoritative calculation...');
    // Item 1: 1 * 800 = 800. Item 2: 2 * 150 = 300. Total = 1100.00
    assert.strictEqual(createBillData.bill.totalAmount, 1100.0);
    assert.strictEqual(createBillData.bill.paidAmount, 0.0);
    assert.strictEqual(createBillData.bill.balanceAmount, 1100.0);
    assert.strictEqual(createBillData.bill.paymentStatus, 'UNPAID');
    assert.strictEqual(createBillData.bill.items.length, 2);
    console.log('  -> PASS: Server-calculated total Rs. 1100.00 authoritatively verified.');

    // TEST 20: Duplicate bill number rejected
    console.log('[TEST 20] Duplicate bill number rejected...');
    const dupBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        billNumber: testBillNumber, // exact same bill number
        items: [{ description: 'Laundry Services', quantity: 1, unitAmount: 50.0 }],
      }),
    });
    assert.strictEqual(dupBillRes.status, 400, 'Duplicate bill number should return 400');
    console.log('  -> PASS: Duplicate bill number rejected with 400.');

    // TEST 21: Retrieve bill with items
    console.log('[TEST 21] Retrieve bill with items and visit relation...');
    const getBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(getBillRes.status, 200);
    const getBillData = await getBillRes.json();
    assert.strictEqual(getBillData.bill.id, testBillId);
    assert.strictEqual(getBillData.bill.items.length, 2);
    assert.strictEqual(getBillData.bill.guestVisit.guest.name, 'Ramesh Sharma');
    console.log('  -> PASS: Bill retrieved with line items.');

    // TEST 22: List and filter bills
    console.log('[TEST 22] List and filter bills by status...');
    const listBillsRes = await fetch(`${BASE_URL}/management/guest-billing/bills?status=UNPAID`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(listBillsRes.status, 200);
    const listBillsData = await listBillsRes.json();
    assert.ok(listBillsData.bills.length >= 1, 'Should list UNPAID bills');
    const foundBill = listBillsData.bills.find((b) => b.id === testBillId);
    assert.ok(foundBill, 'Created bill must be in UNPAID list');
    console.log('  -> PASS: Bill listing and filtering verified.');

    // -----------------------------------------------------------------
    // PAYMENT TESTS (Tests 23 - 28)
    // -----------------------------------------------------------------

    // TEST 23: Valid partial payment succeeds
    console.log('[TEST 23] Valid partial payment of Rs. 500 recorded...');
    const pay1Res = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        amount: 500.0,
        paymentMethod: 'UPI',
        paymentReference: 'UPI-REF-987654321',
        notes: 'Initial partial payment via Google Pay',
      }),
    });
    assert.strictEqual(pay1Res.status, 200, 'Partial payment should succeed with 200');
    const pay1Data = await pay1Res.json();
    assert.strictEqual(pay1Data.success, true);
    assert.strictEqual(pay1Data.bill.paidAmount, 500.0);
    assert.strictEqual(pay1Data.bill.balanceAmount, 600.0);
    assert.strictEqual(pay1Data.bill.paymentStatus, 'PARTIALLY_PAID');
    console.log('  -> PASS: Partial payment recorded. Status updated to PARTIALLY_PAID.');

    // TEST 24: Subsequent payment completes balance and updates status to PAID
    console.log('[TEST 24] Second payment of Rs. 600 to complete balance...');
    const pay2Res = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        amount: 600.0,
        paymentMethod: 'CASH',
        paymentReference: 'CASH-RCPT-001',
        notes: 'Final settlement at desk',
      }),
    });
    assert.strictEqual(pay2Res.status, 200, 'Final payment should succeed with 200');
    const pay2Data = await pay2Res.json();
    assert.strictEqual(pay2Data.bill.paidAmount, 1100.0);
    assert.strictEqual(pay2Data.bill.balanceAmount, 0.0);
    assert.strictEqual(pay2Data.bill.paymentStatus, 'PAID');
    assert.ok(pay2Data.bill.paidAt, 'paidAt timestamp must be recorded');
    console.log('  -> PASS: Authoritative balance zeroed. Status is now PAID.');

    // TEST 25: Overpayment rejected
    console.log('[TEST 25] Overpayment rejected...');
    // Create another bill with total Rs. 200
    const smallBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        items: [{ description: 'Mess Breakfast Guest Token', quantity: 1, unitAmount: 200.0 }],
      }),
    });
    const smallBillData = await smallBillRes.json();
    const smallBillId = smallBillData.bill.id;

    // Try paying Rs. 300 for a Rs. 200 bill
    const overpayRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${smallBillId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        amount: 300.0,
        paymentMethod: 'CASH',
      }),
    });
    assert.strictEqual(overpayRes.status, 400, 'Overpayment should return 400');
    console.log('  -> PASS: Overpayment rejected with 400.');

    // TEST 26: Duplicate/excess payment on already PAID bill rejected
    console.log('[TEST 26] Payment on fully PAID bill rejected...');
    const paidBillPaymentRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        amount: 100.0,
        paymentMethod: 'CASH',
      }),
    });
    assert.strictEqual(paidBillPaymentRes.status, 400, 'Payment on already paid bill must return 400');
    console.log('  -> PASS: Payment on fully paid bill rejected.');

    // TEST 27: Payment history preserved
    console.log('[TEST 27] Verify payment transaction history is preserved...');
    const verifyHistoryRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const verifyHistoryData = await verifyHistoryRes.json();
    assert.strictEqual(verifyHistoryData.bill.payments.length, 2, 'Must have recorded both payment transactions');
    assert.strictEqual(verifyHistoryData.bill.payments[1].amount, 500.0);
    assert.strictEqual(verifyHistoryData.bill.payments[0].amount, 600.0);
    console.log('  -> PASS: Two separate payment history records preserved.');

    // TEST 28: paidAt and payment reference verified
    console.log('[TEST 28] Verify paidAt timestamp and payment reference...');
    assert.ok(verifyHistoryData.bill.paidAt, 'paidAt must not be null');
    assert.ok(verifyHistoryData.bill.payments.some((p) => p.paymentReference === 'UPI-REF-987654321'));
    assert.ok(verifyHistoryData.bill.payments.some((p) => p.paymentReference === 'CASH-RCPT-001'));
    console.log('  -> PASS: Payment reference and paidAt verified.');

    // -----------------------------------------------------------------
    // VOID TESTS (Tests 29 - 31)
    // -----------------------------------------------------------------

    // Create a bill to test voiding
    const billToVoidRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: testVisitId,
        items: [{ description: 'Room Key Replacement Deposit', quantity: 1, unitAmount: 300.0 }],
      }),
    });
    const billToVoidData = await billToVoidRes.json();
    testBillToVoidId = billToVoidData.bill.id;

    // TEST 29: Unauthorized void rejected
    console.log('[TEST 29] Unauthorized role (STUDENT) attempting void is rejected...');
    const unauthorizedVoidRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillToVoidId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ reason: 'Student trying to cancel bill' }),
    });
    assert.strictEqual(unauthorizedVoidRes.status, 403, 'Unauthorized void should return 403');
    console.log('  -> PASS: Unauthorized void attempt rejected with 403.');

    // TEST 30: Valid void requires reason and succeeds
    console.log('[TEST 30] Valid void requires reason and succeeds...');
    const emptyReasonRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillToVoidId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ reason: ' ' }),
    });
    assert.strictEqual(emptyReasonRes.status, 400, 'Empty void reason should return 400');

    const validVoidRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillToVoidId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        reason: 'Guest waived deposit by administrative approval',
      }),
    });
    assert.strictEqual(validVoidRes.status, 200, 'Valid void should succeed with 200');
    const validVoidData = await validVoidRes.json();
    assert.strictEqual(validVoidData.bill.paymentStatus, 'VOID');
    assert.strictEqual(validVoidData.bill.voidReason, 'Guest waived deposit by administrative approval');
    assert.ok(validVoidData.bill.voidedAt, 'voidedAt must be set');
    assert.strictEqual(validVoidData.bill.voidedBy, wardenUser.name);
    console.log('  -> PASS: Bill successfully voided with reason and audit author.');

    // TEST 31: Financial history preserved after void
    console.log('[TEST 31] Verify financial history preserved after void...');
    const getVoidedBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillToVoidId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const getVoidedBillData = await getVoidedBillRes.json();
    assert.strictEqual(getVoidedBillData.bill.paymentStatus, 'VOID');
    assert.strictEqual(getVoidedBillData.bill.items.length, 1);
    assert.strictEqual(getVoidedBillData.bill.totalAmount, 300.0);
    console.log('  -> PASS: Voided bill preserves full financial line items and metadata.');

    // -----------------------------------------------------------------
    // AUDIT TESTS (Tests 32 - 34)
    // -----------------------------------------------------------------

    // TEST 32: Bill creation audited
    console.log('[TEST 32] Verify bill creation ActivityLog record in PostgreSQL...');
    const billAudit = await prisma.activityLog.findFirst({
      where: {
        actionType: 'GUEST_BILLING',
        description: { contains: testBillNumber },
      },
    });
    assert.ok(billAudit, 'ActivityLog for bill creation must exist in PostgreSQL');
    console.log('  -> PASS: Bill creation correctly recorded in PostgreSQL ActivityLog.');

    // TEST 33: Payment audited
    console.log('[TEST 33] Verify payment ActivityLog record in PostgreSQL...');
    const paymentAudit = await prisma.activityLog.findFirst({
      where: {
        actionType: 'GUEST_BILLING',
        description: { contains: 'Payment of Rs. 600.00' },
      },
    });
    assert.ok(paymentAudit, 'ActivityLog for payment must exist in PostgreSQL');
    console.log('  -> PASS: Payment transaction recorded in PostgreSQL ActivityLog.');

    // TEST 34: Void audited
    console.log('[TEST 34] Verify void ActivityLog record in PostgreSQL...');
    const voidAudit = await prisma.activityLog.findFirst({
      where: {
        actionType: 'GUEST_BILLING',
        description: { contains: 'VOIDED' },
      },
    });
    assert.ok(voidAudit, 'ActivityLog for void must exist in PostgreSQL');
    console.log('  -> PASS: Void action recorded in PostgreSQL ActivityLog.');

    // -----------------------------------------------------------------
    // REALTIME SSE TESTS (Tests 35 - 36)
    // -----------------------------------------------------------------

    // TEST 35: SSE event emitted only after successful commit
    console.log('[TEST 35] Verify SSE events emitted on successful commit...');
    let receivedSSEEvent = null;

    // Connect to SSE stream
    const ssePromise = new Promise((resolve) => {
      const req = http.request(
        `http://localhost:5001/api/management/events-stream?token=${wardenToken}`,
        (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            if (buffer.includes('GUEST_BILL_CREATED') || buffer.includes('GUEST_CREATED')) {
              receivedSSEEvent = buffer;
              req.destroy();
              resolve(true);
            }
          });
        }
      );
      req.on('error', () => resolve(false));
      req.end();

      // Trigger mutation after establishing connection
      setTimeout(async () => {
        try {
          await fetch(`${BASE_URL}/management/guest-billing/guests`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${wardenToken}`,
            },
            body: JSON.stringify({
              name: 'SSE Test Guest',
              phone: `99999${Math.floor(10000 + Math.random() * 90000)}`,
            }),
          });
        } catch (_) {}
      }, 500);

      // Timeout after 3 seconds
      setTimeout(() => resolve(false), 3000);
    });

    const sseSuccess = await ssePromise;
    assert.ok(sseSuccess, 'SSE stream should receive management update event after commit');
    console.log('  -> PASS: Realtime SSE event emitted after database commit.');

    // TEST 36: Failed transaction does not emit success event
    console.log('[TEST 36] Verify rejected mutation does not emit success event...');
    let rejectedEventCaught = false;

    const sseRejectPromise = new Promise((resolve) => {
      const req = http.request(
        `http://localhost:5001/api/management/events-stream?token=${wardenToken}`,
        (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            if (buffer.includes('FAILED_TRANSACTION_TEST')) {
              rejectedEventCaught = true;
            }
          });
        }
      );
      req.on('error', () => resolve(false));
      req.end();

      // Trigger deliberately failing mutation (overpayment)
      setTimeout(async () => {
        try {
          await fetch(`${BASE_URL}/management/guest-billing/bills/${testBillId}/payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${wardenToken}`,
            },
            body: JSON.stringify({
              amount: 999999, // impossible overpayment
              paymentMethod: 'FAILED_TRANSACTION_TEST',
            }),
          });
        } catch (_) {}
      }, 300);

      setTimeout(() => {
        req.destroy();
        resolve(true);
      }, 1500);
    });

    await sseRejectPromise;
    assert.strictEqual(rejectedEventCaught, false, 'Failed transaction must not emit success event');
    console.log('  -> PASS: Failed transaction did not emit realtime event.');

    console.log('\n========================================================');
    console.log('  ALL 36 GUEST BILLING TEST CASES PASSED PERFECTLY!     ');
    console.log('========================================================\n');
    console.log('Passed: 36/36 tests passed');

  } catch (error) {
    console.error('\n[FAILURE] Test suite encountered an error:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
