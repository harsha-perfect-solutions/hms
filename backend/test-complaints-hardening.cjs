const assert = require('assert');
const http = require('http');

// Helper to create a valid minimal 1x1 JPEG buffer
function createValidJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

// Multipart form builder for uploading buffers via native fetch
function buildMultipartBody(boundary, fieldName, filename, mimeType, fileBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

async function runHardeningTests() {
  console.log('=== Running Step 6 Complaints Hardening Pass Test Suite ===\n');

  // 1. Authenticate Student A (MANI MANASVI GAVARA - 25331A05H7)
  const loginARes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  assert.strictEqual(loginARes.status, 200);
  const tokenA = (await loginARes.json()).token;

  // 2. Authenticate Student B (NAKKULLA RITHIKA - 25331A05H8)
  const loginBRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
  });
  assert.strictEqual(loginBRes.status, 200);
  const tokenB = (await loginBRes.json()).token;

  // --------------------------------------------------------------------------
  // PART A: DETAIL API TESTING (Phase 2)
  // --------------------------------------------------------------------------
  console.log('--- Part A: Dedicated Complaint Detail API ---');

  // A1. Create a complaint for Student A
  const createRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'PLUMBING',
      title: 'Water tap leaking heavily - ' + Date.now(),
      description: 'Bathroom wash basin tap leaking continuously and needs washer replacement.',
      priority: 'MEDIUM',
    }),
  });
  assert.strictEqual(createRes.status, 201);
  const complaintA = (await createRes.json()).complaint;
  const complaintId = complaintA.id;
  console.log('[PASS] 1. Created test complaint for Student A:', complaintA.ticketNumber);

  // A2. Unauthenticated request to Detail API must return 401
  const unauthDetailRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}`);
  assert.strictEqual(unauthDetailRes.status, 401, 'Unauthenticated detail request must return 401');
  console.log('[PASS] 2. Unauthenticated GET /api/student/complaints/:id rejected with 401');

  // A3. Authenticated Student A retrieves own complaint details -> 200
  const authDetailRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(authDetailRes.status, 200);
  const detailData = await authDetailRes.json();
  assert.strictEqual(detailData.success, true);
  assert.strictEqual(detailData.complaint.id, complaintId);
  assert.strictEqual(detailData.complaint.category, 'PLUMBING');
  assert.strictEqual(Array.isArray(detailData.complaint.timeline), true, 'Timeline must be included');
  assert.strictEqual(Array.isArray(detailData.complaint.attachments), true, 'Attachments array must be included');
  console.log('[PASS] 3. Student A successfully retrieved own authoritative complaint detail with timeline');

  // A4. IDOR Check: Student B attempts to access Student A's complaint -> 403 Forbidden
  const idorDetailRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorDetailRes.status, 403, 'Student B viewing Student A complaint must return 403 Forbidden');
  console.log('[PASS] 4. Detail IDOR protected: Student B access rejected with 403 Forbidden');

  // A5. Nonexistent complaint ID -> 404 Not Found
  const nonExistentRes = await fetch('http://localhost:5001/api/student/complaints/00000000-0000-0000-0000-000000000000', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(nonExistentRes.status, 404, 'Non-existent complaint must return 404');
  console.log('[PASS] 5. Non-existent complaint ID returns 404 Not Found');

  // --------------------------------------------------------------------------
  // PART B: ATTACHMENTS SUBSYSTEM (Phase 4 & 5)
  // --------------------------------------------------------------------------
  console.log('\n--- Part B: Secure File Attachments Subsystem ---');

  const boundary = '----WebKitFormBoundaryHMS' + Date.now();
  const validJpeg = createValidJpegBuffer();

  // B1. Valid JPEG Upload
  const validMultipart = buildMultipartBody(boundary, 'file', 'broken_tap.jpg', 'image/jpeg', validJpeg);
  const uploadRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: validMultipart,
  });
  assert.strictEqual(uploadRes.status, 201, 'Valid upload must return 201');
  const uploadData = await uploadRes.json();
  assert.strictEqual(uploadData.success, true);
  assert.strictEqual(uploadData.attachment.fileName, 'broken_tap.jpg');
  assert.strictEqual(uploadData.attachment.mimeType, 'image/jpeg');
  assert.strictEqual(uploadData.attachment.fileSize, validJpeg.length);
  const attachmentId = uploadData.attachment.id;
  console.log('[PASS] 6. Valid JPEG attachment uploaded and metadata persisted in PostgreSQL:', uploadData.attachment.id);

  // B2. Student A downloads own attachment -> 200 OK
  const downloadRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(downloadRes.status, 200);
  assert.strictEqual(downloadRes.headers.get('content-type'), 'image/jpeg');
  const downloadedBytes = Buffer.from(await downloadRes.arrayBuffer());
  assert.strictEqual(downloadedBytes.length, validJpeg.length, 'Downloaded binary size must match uploaded size');
  console.log('[PASS] 7. Student A successfully downloaded authoritative attachment binary');

  // B3. Attachment IDOR: Student B attempts to download Student A's attachment -> 403 Forbidden
  const idorDownloadRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorDownloadRes.status, 403, 'Student B downloading Student A attachment must return 403 Forbidden');
  console.log('[PASS] 8. Attachment IDOR protected: Student B download rejected with 403 Forbidden');

  // B4. Unauthenticated download attempt -> 401 Unauthorized
  const unauthDownloadRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments/${attachmentId}`);
  assert.strictEqual(unauthDownloadRes.status, 401, 'Unauthenticated download must return 401');
  console.log('[PASS] 9. Unauthenticated attachment download rejected with 401');

  // B5. MIME Spoofing Check: declared 'image/png' but sending plain text content
  const fakePngBuffer = Buffer.from('THIS IS NOT A VALID PNG FILE BUT PLAIN TEXT SCRIPT');
  const spoofBoundary = '----WebKitFormBoundarySpoof' + Date.now();
  const spoofMultipart = buildMultipartBody(spoofBoundary, 'file', 'exploit.png', 'image/png', fakePngBuffer);
  const spoofRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${spoofBoundary}`,
    },
    body: spoofMultipart,
  });
  assert.strictEqual(spoofRes.status, 400, 'MIME spoofing must be rejected with 400 Bad Request');
  const spoofData = await spoofRes.json();
  console.log('[PASS] 10. MIME spoofing prevented by magic number validation (400 Bad Request):', spoofData.message);

  // B6. Disallowed File Extension (e.g. .exe / .sh)
  const exeBuffer = Buffer.from('MZ executable simulation');
  const exeBoundary = '----WebKitFormBoundaryExe' + Date.now();
  const exeMultipart = buildMultipartBody(exeBoundary, 'file', 'malware.exe', 'application/x-msdownload', exeBuffer);
  const exeRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${exeBoundary}`,
    },
    body: exeMultipart,
  });
  assert.strictEqual(exeRes.status, 400, 'Executable upload must return 400');
  console.log('[PASS] 11. Disallowed file extension (.exe) rejected with 400 Bad Request');

  // B7. Oversized file (> 5MB)
  const hugeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB
  const hugeBoundary = '----WebKitFormBoundaryHuge' + Date.now();
  const hugeMultipart = buildMultipartBody(hugeBoundary, 'file', 'oversized.jpg', 'image/jpeg', hugeBuffer);
  const hugeRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${hugeBoundary}`,
    },
    body: hugeMultipart,
  });
  assert.strictEqual(hugeRes.status, 400, 'Oversized file must return 400');
  console.log('[PASS] 12. Oversized file (> 5MB) rejected with 400 Bad Request');

  // B8. List Attachments API
  const listRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/attachments`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  assert.strictEqual(listData.attachments.length, 1);
  assert.strictEqual(listData.attachments[0].id, attachmentId);
  console.log('[PASS] 13. List attachments API returns accurate metadata array');

  // --------------------------------------------------------------------------
  // PART C: REAL-TIME SERVER-SENT EVENTS (Phase 8, 9, 10)
  // --------------------------------------------------------------------------
  console.log('\n--- Part C: Server-Sent Events (SSE) Real-Time Synchronization ---');

  // C1. Unauthenticated SSE connection rejected with 401
  const unauthSseRes = await fetch('http://localhost:5001/api/student/complaints/events');
  assert.strictEqual(unauthSseRes.status, 401, 'Unauthenticated SSE must return 401');
  console.log('[PASS] 14. Unauthenticated GET /api/student/complaints/events rejected with 401');

  // C2. Connect Student A to SSE stream and test domain event emission & isolation
  await new Promise((resolve, reject) => {
    let studentAReceivedEvent = false;
    let studentBReceivedEvent = false;

    // Connect Student A SSE
    const reqA = http.request(
      `http://localhost:5001/api/student/complaints/events?token=${encodeURIComponent(tokenA)}`,
      (resA) => {
        assert.strictEqual(resA.statusCode, 200);
        assert.strictEqual(resA.headers['content-type'], 'text/event-stream');

        resA.on('data', (chunk) => {
          const text = chunk.toString();
          if (text.includes('complaint_event')) {
            studentAReceivedEvent = true;
          }
        });
      }
    );
    reqA.end();

    // Connect Student B SSE
    const reqB = http.request(
      `http://localhost:5001/api/student/complaints/events?token=${encodeURIComponent(tokenB)}`,
      (resB) => {
        assert.strictEqual(resB.statusCode, 200);

        resB.on('data', (chunk) => {
          const text = chunk.toString();
          if (text.includes('complaint_event')) {
            studentBReceivedEvent = true;
          }
        });
      }
    );
    reqB.end();

    // Allow connections to establish then trigger an event on Student A's complaint
    setTimeout(async () => {
      try {
        // Trigger a comment on Student A's complaint
        const commentRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/comment`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment: 'Technician checked and replaced the rubber washer.' }),
        });
        assert.strictEqual(commentRes.status, 200);

        // Wait a short moment to receive SSE event
        setTimeout(() => {
          reqA.destroy();
          reqB.destroy();

          assert.strictEqual(studentAReceivedEvent, true, 'Student A must receive real-time event for own complaint');
          assert.strictEqual(studentBReceivedEvent, false, 'Student B must NOT receive Student A event (Isolation violation)');
          console.log('[PASS] 15. Authenticated SSE stream connected with text/event-stream headers');
          console.log('[PASS] 16. Real-time domain event delivered to Student A stream upon mutation');
          console.log('[PASS] 17. SSE Student Isolation verified: Student B stream received 0 cross-student events');
          resolve();
        }, 500);
      } catch (e) {
        reqA.destroy();
        reqB.destroy();
        reject(e);
      }
    }, 400);
  });

  console.log('\n=== All Step 6 Hardening Tests (17/17) PASSED Successfully! ===');
}

runHardeningTests().catch((err) => {
  console.error('Hardening test failure:', err);
  process.exit(1);
});
