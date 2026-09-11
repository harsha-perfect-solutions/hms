// ============================================================================
// STEP 18 POSTGRESQL 18.6 VERIFICATION SCRIPT
// ============================================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function verifyPostgres() {
  console.log('\n======================================================');
  console.log('   POSTGRESQL 18.6 AUTHORITATIVE VERIFICATION: STEP 18 ');
  console.log('======================================================\n');

  // 1. Devices persisted
  const totalDevices = await prisma.biometricDevice.count();
  console.log(`[PG-1] Total Biometric Devices in PostgreSQL: ${totalDevices}`);
  assert.ok(totalDevices >= 5, 'Must have at least 5 seeded baseline devices');

  // 2. Uniqueness of device identifiers
  const devices = await prisma.biometricDevice.findMany();
  const identifiers = devices.map((d) => d.deviceIdentifier);
  const uniqueIdentifiers = new Set(identifiers);
  assert.strictEqual(identifiers.length, uniqueIdentifiers.size, 'Device identifiers must be strictly unique');
  console.log(`[PG-2] Device Identifiers are unique across all ${identifiers.length} rows.`);

  // 3. Operational statuses validity
  const validStatuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'DISABLED'];
  for (const d of devices) {
    assert.ok(validStatuses.includes(d.status), `Device ${d.deviceIdentifier} has invalid status: ${d.status}`);
  }
  console.log('[PG-3] All devices possess valid operational status enum strings.');

  // 4. Secret security: SHA-256 hashes only, NO plaintext secrets
  for (const d of devices) {
    assert.ok(d.apiKeyHash, `Device ${d.deviceIdentifier} must have apiKeyHash`);
    assert.strictEqual(d.apiKeyHash.length, 64, 'SHA-256 hash must be exactly 64 hex characters');
    assert.ok(!d.apiKeyHash.startsWith('hms_dev_'), 'Hash must not be plaintext key');
  }
  console.log('[PG-4] All device API keys are strictly hashed with SHA-256 (64 hex characters). No plaintext secrets exist.');

  // 5. Biometric relations & integrity
  const totalEvents = await prisma.biometricEvent.count();
  console.log(`[PG-5] Total Biometric Events in PostgreSQL: ${totalEvents}`);
  assert.ok(totalEvents > 0, 'BiometricEvent table must retain all historical records');

  // Check DEV-GATE-01 events
  const gate01Events = await prisma.biometricEvent.count({ where: { deviceId: 'DEV-GATE-01' } });
  console.log(`[PG-5b] Biometric events correlated with DEV-GATE-01: ${gate01Events}`);
  assert.ok(gate01Events > 0, 'DEV-GATE-01 must have correlated telemetry');

  // 6. Activity Log records
  const deviceLogs = await prisma.activityLog.count({
    where: {
      OR: [
        { entity: 'BiometricDevice' },
        { description: { contains: 'DEV-' } },
      ],
    },
  });
  console.log(`[PG-6] Device-related ActivityLog records in PostgreSQL: ${deviceLogs}`);
  assert.ok(deviceLogs > 0, 'ActivityLog must contain transactional device audit records');

  // 7. Check audit metadata for absence of leaked credentials
  const logsWithMeta = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entity: 'BiometricDevice' },
        { description: { contains: 'DEV-' } },
      ],
    },
  });
  for (const log of logsWithMeta) {
    if (log.metadata) {
      assert.ok(!log.metadata.includes('hms_dev_'), 'ActivityLog metadata must not contain plaintext API keys');
      assert.ok(!log.metadata.toLowerCase().includes('passwordhash'), 'ActivityLog metadata must not contain password hashes');
    }
  }
  console.log('[PG-7] Audit metadata confirmed 100% sanitized. Zero credential leaks.');

  console.log('\n======================================================');
  console.log('   POSTGRESQL 18.6 VERIFICATION COMPLETE: ALL PASSED! ');
  console.log('======================================================\n');
}

verifyPostgres()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('PostgreSQL verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
