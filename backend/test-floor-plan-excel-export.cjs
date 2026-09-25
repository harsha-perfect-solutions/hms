const assert = require('assert');
const XLSX = require('xlsx');

const API_BASE = 'http://localhost:5001/api';

async function testFloorPlanExcelExport() {
  console.log('=== Testing Entire Floor Plan Excel Export Endpoint ===\n');

  // 1. Authenticate as Warden / Management
  const loginRes = await fetch(`${API_BASE}/management/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'WARDEN01',
      password: 'Password@123',
    }),
  });
  assert.strictEqual(loginRes.status, 200, 'Warden login must succeed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, 'Must return JWT token');
  console.log('[PASS] 1. Authorized management token obtained');

  // 2. Unauthenticated request to /export-excel must fail with 401
  const unauthRes = await fetch(`${API_BASE}/management/rooms/export-excel`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected');
  console.log('[PASS] 2. RBAC check: Unauthenticated request rejected with 401');

  // 3. Authorized request to /export-excel
  const exportRes = await fetch(`${API_BASE}/management/rooms/export-excel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(exportRes.status, 200, 'Excel export request must return 200 OK');

  const contentType = exportRes.headers.get('content-type');
  assert(
    contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    `Content-Type must be valid Excel spreadsheetml, got: ${contentType}`
  );

  const contentDisposition = exportRes.headers.get('content-disposition');
  assert(
    contentDisposition.includes('attachment') && contentDisposition.includes('hostel_entire_floor_plan_'),
    `Content-Disposition header must specify attachment filename, got: ${contentDisposition}`
  );
  console.log('[PASS] 3. Response headers match valid .xlsx binary attachment');

  // 4. Validate workbook contents using XLSX parser
  const arrayBuffer = await exportRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const expectedSheets = [
    'Floor Plan Overview',
    'Student Allocations',
    'First Floor',
    'Second Floor',
    'Third Floor',
  ];
  for (const sheetName of expectedSheets) {
    assert(workbook.SheetNames.includes(sheetName), `Workbook must contain sheet: ${sheetName}`);
  }
  console.log('[PASS] 4. Workbook contains all 5 authoritative sheets:', workbook.SheetNames);

  // 5. Validate Overview Sheet rows
  const overviewSheet = workbook.Sheets['Floor Plan Overview'];
  const overviewRows = XLSX.utils.sheet_to_json(overviewSheet);
  assert.strictEqual(overviewRows.length, 19, 'Overview sheet must have 19 authoritative rooms');
  
  // Verify columns in overview
  const sampleOverviewRow = overviewRows[0];
  assert(sampleOverviewRow['Floor'], 'Must include Floor name');
  assert(sampleOverviewRow['Room Number'], 'Must include Room Number');
  assert(sampleOverviewRow['Bed Capacity'] !== undefined, 'Must include Bed Capacity');
  assert(sampleOverviewRow['Allocated Beds'] !== undefined, 'Must include Allocated Beds');
  assert(sampleOverviewRow['Available Beds'] !== undefined, 'Must include Available Beds');
  assert(sampleOverviewRow['Occupancy Status'], 'Must include Occupancy Status');
  assert(sampleOverviewRow['Allocated Residents'], 'Must include Allocated Residents');
  console.log('[PASS] 5. Floor Plan Overview validated with 19 rooms and all required columns');

  // 6. Validate Student Allocations Sheet rows
  const studentsSheet = workbook.Sheets['Student Allocations'];
  const studentRows = XLSX.utils.sheet_to_json(studentsSheet);
  assert.strictEqual(studentRows.length, 76, 'Student Allocations sheet must have 76 active allocations');
  
  const sampleStudentRow = studentRows[0];
  assert(sampleStudentRow['Student Name'], 'Must include Student Name');
  assert(sampleStudentRow['Roll / JNTU No'], 'Must include Roll / JNTU No');
  assert(sampleStudentRow['Room Number'], 'Must include Room Number');
  assert(sampleStudentRow['Bed Number'], 'Must include Bed Number');
  console.log('[PASS] 6. Student Allocations validated with 76 residents and bed-by-bed mapping');

  // 7. Validate Floor-wise distribution
  const f1Rows = XLSX.utils.sheet_to_json(workbook.Sheets['First Floor']);
  const f2Rows = XLSX.utils.sheet_to_json(workbook.Sheets['Second Floor']);
  const f3Rows = XLSX.utils.sheet_to_json(workbook.Sheets['Third Floor']);
  assert.strictEqual(f1Rows.length, 28, 'First Floor sheet must have 28 students');
  assert.strictEqual(f2Rows.length, 26, 'Second Floor sheet must have 26 students');
  assert.strictEqual(f3Rows.length, 22, 'Third Floor sheet must have 22 students');
  console.log(`[PASS] 7. Floor sheets verified: Floor 1 (${f1Rows.length}), Floor 2 (${f2Rows.length}), Floor 3 (${f3Rows.length}) = 76 students total`);

  console.log('\n======================================================');
  console.log('  ALL FLOOR PLAN EXCEL EXPORT CHECKS PASSED (7/7)');
  console.log('======================================================\n');
}

testFloorPlanExcelExport().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
