import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.service';
import { complaintEventsService } from './events.service';
import { auditService } from './audit.service';

export const VALID_DEVICE_TYPES = ['BIOMETRIC', 'GATE_READER', 'RFID', 'TURNSTILE', 'OTHER'] as const;
export type DeviceType = (typeof VALID_DEVICE_TYPES)[number];

export const VALID_DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'DISABLED'] as const;
export type DeviceStatus = (typeof VALID_DEVICE_STATUSES)[number];

export interface DeviceListQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  enabled?: string | boolean;
  location?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateDeviceDto {
  name: string;
  deviceIdentifier: string;
  deviceType: string;
  location: string;
  description?: string;
  isEnabled?: boolean;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  maintenanceNotes?: string;
  configMetadata?: any;
}

export interface UpdateDeviceDto {
  name?: string;
  location?: string;
  deviceType?: string;
  description?: string;
  status?: string;
  isEnabled?: boolean;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  maintenanceNotes?: string;
  lastMaintenanceDate?: string | Date;
  configMetadata?: any;
}

export class DeviceService {
  /**
   * Helper: Hash an API key or device secret with SHA-256
   */
  public hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Helper: Generate a cryptographically secure device API key
   */
  public generateSecureApiKey(): string {
    return `hms_dev_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Helper: Sanitize device object to ensure secret material is NEVER leaked
   */
  public sanitizeDevice(device: any) {
    if (!device) return null;
    const { apiKeyHash, ...sanitized } = device;
    return {
      ...sanitized,
      hasApiKey: !!apiKeyHash,
      keyLastRotatedAt: device.keyLastRotatedAt ? new Date(device.keyLastRotatedAt).toISOString() : null,
      lastSeenAt: device.lastSeenAt ? new Date(device.lastSeenAt).toISOString() : null,
      lastMaintenanceDate: device.lastMaintenanceDate ? new Date(device.lastMaintenanceDate).toISOString() : null,
      createdAt: new Date(device.createdAt).toISOString(),
      updatedAt: new Date(device.updatedAt).toISOString(),
    };
  }

  /**
   * Helper: Record device audit trail transactionally
   */
  private async recordDeviceAudit(
    tx: any,
    action: string,
    dev: any,
    actor: { id: string; username: string; role: string },
    description: string,
    previousState?: any,
    newState?: any
  ) {
    let resolvedActorId = actor.id;
    if (!resolvedActorId || resolvedActorId === 'system') {
      const admin = await prisma.student.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'HOSTEL_ADMIN'] } },
        select: { id: true },
      });
      if (admin) {
        resolvedActorId = admin.id;
      }
    }

    if (resolvedActorId) {
      await auditService.recordLog(
        {
          actorId: resolvedActorId,
          actorRole: actor.role || 'ADMIN',
          action,
          actionType: 'DEVICE',
          entity: 'BiometricDevice',
          entityId: dev.id,
          description,
          previousState,
          newState,
          metadata: {
            deviceIdentifier: dev.deviceIdentifier,
            name: dev.name,
            location: dev.location,
            status: dev.status,
            isEnabled: dev.isEnabled,
          },
        },
        tx,
        false
      );
    }
  }

  /**
   * Authoritative List of Devices with Search, Filters, KPIs, and Bounded Pagination
   */
  public async getDevices(query: DeviceListQuery) {
    const countCheck = await prisma.biometricDevice.count();
    if (countCheck === 0) {
      await this.seedDefaultDevicesIfEmpty();
    }

    const rawPage = Number(query.page);
    const pageNum = isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;

    const rawSize = Number(query.pageSize || query.limit);
    const pageSize = isNaN(rawSize) || rawSize <= 0 ? 25 : Math.min(100, rawSize);
    const skip = (pageNum - 1) * pageSize;

    const where: Prisma.BiometricDeviceWhereInput = {};

    // Search query: matches name, deviceIdentifier, or location
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { deviceIdentifier: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Type filter
    if (query.type && query.type !== 'ALL') {
      where.deviceType = query.type;
    }

    // Status filter
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    // Enabled filter
    if (query.enabled !== undefined && query.enabled !== 'ALL') {
      where.isEnabled = query.enabled === true || query.enabled === 'true' || query.enabled === '1';
    }

    // Location filter
    if (query.location && query.location !== 'ALL') {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    // Live Authoritative KPIs
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const [
      totalDevices,
      activeDevices,
      disabledDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
    ] = await Promise.all([
      prisma.biometricDevice.count(),
      prisma.biometricDevice.count({ where: { isEnabled: true } }),
      prisma.biometricDevice.count({ where: { isEnabled: false } }),
      prisma.biometricDevice.count({
        where: {
          isEnabled: true,
          status: 'ONLINE',
          lastSeenAt: { gte: fifteenMinutesAgo },
        },
      }),
      prisma.biometricDevice.count({
        where: {
          isEnabled: true,
          OR: [
            { status: 'OFFLINE' },
            { lastSeenAt: { lt: fifteenMinutesAgo } },
            { lastSeenAt: null },
          ],
        },
      }),
      prisma.biometricDevice.count({ where: { status: 'MAINTENANCE' } }),
    ]);

    // Query devices with sorting
    const [devices, totalFiltered] = await Promise.all([
      prisma.biometricDevice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortOrder || 'asc' } : { createdAt: 'desc' },
      }),
      prisma.biometricDevice.count({ where }),
    ]);

    // Re-evaluate operational status dynamically based on last communication
    const enrichedDevices = devices.map((dev) => {
      let authoritativeStatus = dev.status;
      if (!dev.isEnabled) {
        authoritativeStatus = 'DISABLED';
      } else if (dev.status === 'MAINTENANCE') {
        authoritativeStatus = 'MAINTENANCE';
      } else if (dev.lastSeenAt && new Date(dev.lastSeenAt) >= fifteenMinutesAgo) {
        authoritativeStatus = 'ONLINE';
      } else {
        authoritativeStatus = 'OFFLINE';
      }

      return {
        ...this.sanitizeDevice(dev),
        status: authoritativeStatus,
      };
    });

    return {
      devices: enrichedDevices,
      stats: {
        totalDevices,
        activeDevices,
        disabledDevices,
        onlineDevices,
        offlineDevices,
        maintenanceDevices,
      },
      pagination: {
        page: pageNum,
        pageSize,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / pageSize) || 1,
      },
    };
  }

  /**
   * Authoritative Single Device Detail with Correlated Telemetry & Event Metrics
   */
  public async getDeviceDetail(id: string) {
    const device = await prisma.biometricDevice.findFirst({
      where: {
        OR: [{ id }, { deviceIdentifier: id }],
      },
    });

    if (!device) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    // Correlate with historical BiometricEvent records
    const [totalEvents, lastEvent, verifiedCount, rejectedCount] = await Promise.all([
      prisma.biometricEvent.count({
        where: { deviceId: device.deviceIdentifier },
      }),
      prisma.biometricEvent.findFirst({
        where: { deviceId: device.deviceIdentifier },
        orderBy: { eventTimestamp: 'desc' },
      }),
      prisma.biometricEvent.count({
        where: {
          deviceId: device.deviceIdentifier,
          verificationStatus: 'VERIFIED',
        },
      }),
      prisma.biometricEvent.count({
        where: {
          deviceId: device.deviceIdentifier,
          verificationStatus: 'REJECTED',
        },
      }),
    ]);

    // Real status evaluation
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    let authoritativeStatus = device.status;
    if (!device.isEnabled) {
      authoritativeStatus = 'DISABLED';
    } else if (device.status === 'MAINTENANCE') {
      authoritativeStatus = 'MAINTENANCE';
    } else if (device.lastSeenAt && new Date(device.lastSeenAt) >= fifteenMinutesAgo) {
      authoritativeStatus = 'ONLINE';
    } else {
      authoritativeStatus = 'OFFLINE';
    }

    return {
      ...this.sanitizeDevice(device),
      status: authoritativeStatus,
      telemetry: {
        totalEvents,
        verifiedEvents: verifiedCount,
        rejectedEvents: rejectedCount,
        lastEventTimestamp: lastEvent ? lastEvent.eventTimestamp.toISOString() : null,
        lastEventType: lastEvent ? lastEvent.eventType : null,
        lastGate: lastEvent ? lastEvent.gate : device.location,
      },
    };
  }

  /**
   * Register a New Physical Device with Secure Cryptographic Key Generation
   */
  public async createDevice(dto: CreateDeviceDto, actor: { id: string; username: string; role: string }) {
    // 1. Validation
    if (!dto.name || !dto.name.trim()) {
      throw new Error('Device name is required.');
    }
    if (!dto.deviceIdentifier || !dto.deviceIdentifier.trim()) {
      throw new Error('Device identifier is required.');
    }
    if (!dto.deviceType || !dto.deviceType.trim()) {
      throw new Error('Device type is required.');
    }
    if (!dto.location || !dto.location.trim()) {
      throw new Error('Device location is required.');
    }

    const cleanIdentifier = dto.deviceIdentifier.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(cleanIdentifier)) {
      throw new Error('Device identifier must only contain alphanumeric characters, underscores, or dashes.');
    }

    if (!VALID_DEVICE_TYPES.includes(dto.deviceType as any)) {
      throw new Error(`Invalid device type. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`);
    }

    // Check uniqueness
    const existing = await prisma.biometricDevice.findUnique({
      where: { deviceIdentifier: cleanIdentifier },
    });
    if (existing) {
      throw new Error('A device with this identifier already exists.');
    }

    // 2. Generate secure random API key
    const plainApiKey = this.generateSecureApiKey();
    const apiKeyHash = this.hashApiKey(plainApiKey);

    // 3. Persist Device and Audit Log Transactionally
    const createdDevice = await prisma.$transaction(async (tx) => {
      const dev = await tx.biometricDevice.create({
        data: {
          deviceIdentifier: cleanIdentifier,
          name: dto.name.trim(),
          deviceType: dto.deviceType,
          location: dto.location.trim(),
          description: dto.description?.trim() || null,
          status: 'OFFLINE',
          isEnabled: dto.isEnabled !== undefined ? !!dto.isEnabled : true,
          apiKeyHash,
          keyLastRotatedAt: new Date(),
          ipAddress: dto.ipAddress?.trim() || null,
          macAddress: dto.macAddress?.trim() || null,
          firmwareVersion: dto.firmwareVersion?.trim() || null,
          maintenanceNotes: dto.maintenanceNotes?.trim() || null,
          configMetadata: dto.configMetadata ? JSON.stringify(dto.configMetadata) : null,
        },
      });

      // Audit Log
      await this.recordDeviceAudit(
        tx,
        'CREATE',
        dev,
        actor,
        `Registered hardware device: ${dev.name} (${dev.deviceIdentifier}) at ${dev.location}`,
        null,
        {
          deviceIdentifier: dev.deviceIdentifier,
          deviceType: dev.deviceType,
          location: dev.location,
          isEnabled: dev.isEnabled,
        }
      );

      return dev;
    });

    // 4. Emit SSE domain event after transaction commit
    complaintEventsService.emitDeviceManagementUpdate({
      type: 'DEVICE_CREATED',
      deviceId: createdDevice.id,
      deviceIdentifier: createdDevice.deviceIdentifier,
      status: createdDevice.status,
      timestamp: new Date().toISOString(),
      details: {
        name: createdDevice.name,
        location: createdDevice.location,
      },
    });

    // 5. Return sanitized device with one-time API key display
    return {
      device: this.sanitizeDevice(createdDevice),
      apiKey: plainApiKey,
      warning: 'ATTENTION: This API credential is shown only once. Store it in a secure location immediately. It cannot be recovered.',
    };
  }

  /**
   * Update Safe Administrative Device Fields
   */
  public async updateDevice(id: string, dto: UpdateDeviceDto, actor: { id: string; username: string; role: string }) {
    const existing = await prisma.biometricDevice.findFirst({
      where: { OR: [{ id }, { deviceIdentifier: id }] },
    });

    if (!existing) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    if (dto.deviceType && !VALID_DEVICE_TYPES.includes(dto.deviceType as any)) {
      throw new Error(`Invalid device type. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`);
    }

    const dataToUpdate: Prisma.BiometricDeviceUpdateInput = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name.trim();
    if (dto.location !== undefined) dataToUpdate.location = dto.location.trim();
    if (dto.deviceType !== undefined) dataToUpdate.deviceType = dto.deviceType;
    if (dto.description !== undefined) dataToUpdate.description = dto.description?.trim() || null;
    if (dto.ipAddress !== undefined) dataToUpdate.ipAddress = dto.ipAddress?.trim() || null;
    if (dto.macAddress !== undefined) dataToUpdate.macAddress = dto.macAddress?.trim() || null;
    if (dto.firmwareVersion !== undefined) dataToUpdate.firmwareVersion = dto.firmwareVersion?.trim() || null;
    if (dto.maintenanceNotes !== undefined) dataToUpdate.maintenanceNotes = dto.maintenanceNotes?.trim() || null;
    if (dto.status !== undefined) {
      if (!VALID_DEVICE_STATUSES.includes(dto.status as any)) {
        throw new Error(`Invalid device status. Allowed: ${VALID_DEVICE_STATUSES.join(', ')}`);
      }
      dataToUpdate.status = dto.status;
    }
    if (dto.isEnabled !== undefined) dataToUpdate.isEnabled = !!dto.isEnabled;
    if (dto.lastMaintenanceDate !== undefined) {
      dataToUpdate.lastMaintenanceDate = dto.lastMaintenanceDate ? new Date(dto.lastMaintenanceDate) : null;
    }
    if (dto.configMetadata !== undefined) {
      dataToUpdate.configMetadata = dto.configMetadata ? JSON.stringify(dto.configMetadata) : null;
    }

    const updatedDevice = await prisma.$transaction(async (tx) => {
      const dev = await tx.biometricDevice.update({
        where: { id: existing.id },
        data: dataToUpdate,
      });

      await this.recordDeviceAudit(
        tx,
        'UPDATE',
        dev,
        actor,
        `Updated device details for ${dev.name} (${dev.deviceIdentifier})`,
        {
          name: existing.name,
          location: existing.location,
          status: existing.status,
          isEnabled: existing.isEnabled,
        },
        {
          name: dev.name,
          location: dev.location,
          status: dev.status,
          isEnabled: dev.isEnabled,
        }
      );

      return dev;
    });

    complaintEventsService.emitDeviceManagementUpdate({
      type: 'DEVICE_UPDATED',
      deviceId: updatedDevice.id,
      deviceIdentifier: updatedDevice.deviceIdentifier,
      status: updatedDevice.status,
      timestamp: new Date().toISOString(),
      details: {
        name: updatedDevice.name,
        location: updatedDevice.location,
      },
    });

    return this.sanitizeDevice(updatedDevice);
  }

  /**
   * Controlled Enable / Disable Device Transitions
   */
  public async setDeviceEnabled(id: string, isEnabled: boolean, actor: { id: string; username: string; role: string }) {
    const existing = await prisma.biometricDevice.findFirst({
      where: { OR: [{ id }, { deviceIdentifier: id }] },
    });

    if (!existing) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    let newStatus = existing.status;
    if (!isEnabled) {
      newStatus = 'DISABLED';
    } else {
      newStatus = existing.lastSeenAt && new Date(existing.lastSeenAt) >= fifteenMinutesAgo ? 'ONLINE' : 'OFFLINE';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dev = await tx.biometricDevice.update({
        where: { id: existing.id },
        data: {
          isEnabled,
          status: newStatus,
        },
      });

      await this.recordDeviceAudit(
        tx,
        isEnabled ? 'ENABLE' : 'DISABLE',
        dev,
        actor,
        `${isEnabled ? 'Enabled' : 'Disabled'} device ${dev.name} (${dev.deviceIdentifier})`,
        { isEnabled: existing.isEnabled, status: existing.status },
        { isEnabled: dev.isEnabled, status: dev.status }
      );

      return dev;
    });

    complaintEventsService.emitDeviceManagementUpdate({
      type: isEnabled ? 'DEVICE_ENABLED' : 'DEVICE_DISABLED',
      deviceId: updated.id,
      deviceIdentifier: updated.deviceIdentifier,
      status: updated.status,
      timestamp: new Date().toISOString(),
    });

    return this.sanitizeDevice(updated);
  }

  /**
   * Secure Device Credential Rotation
   */
  public async rotateDeviceCredential(id: string, actor: { id: string; username: string; role: string }) {
    const existing = await prisma.biometricDevice.findFirst({
      where: { OR: [{ id }, { deviceIdentifier: id }] },
    });

    if (!existing) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    const newPlainApiKey = this.generateSecureApiKey();
    const newApiKeyHash = this.hashApiKey(newPlainApiKey);

    const updated = await prisma.$transaction(async (tx) => {
      const dev = await tx.biometricDevice.update({
        where: { id: existing.id },
        data: {
          apiKeyHash: newApiKeyHash,
          keyLastRotatedAt: new Date(),
        },
      });

      await this.recordDeviceAudit(
        tx,
        'ROTATE_CREDENTIAL',
        dev,
        actor,
        `Rotated API key credential for device ${dev.name} (${dev.deviceIdentifier})`,
        { keyLastRotatedAt: existing.keyLastRotatedAt },
        { keyLastRotatedAt: dev.keyLastRotatedAt }
      );

      return dev;
    });

    complaintEventsService.emitDeviceManagementUpdate({
      type: 'DEVICE_CREDENTIAL_ROTATED',
      deviceId: updated.id,
      deviceIdentifier: updated.deviceIdentifier,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      device: this.sanitizeDevice(updated),
      apiKey: newPlainApiKey,
      warning: 'CRITICAL: The previous API key has been immediately invalidated. Update the device hardware with this new key now. It will NEVER be shown again.',
    };
  }

  /**
   * Device Activity & Audit Trail
   */
  public async getDeviceActivity(id: string, page: number = 1, pageSize: number = 25) {
    const device = await prisma.biometricDevice.findFirst({
      where: { OR: [{ id }, { deviceIdentifier: id }] },
    });

    if (!device) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    const pageNum = Math.max(1, page);
    const limit = Math.min(100, Math.max(1, pageSize));
    const skip = (pageNum - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {
      OR: [
        { entityId: device.id },
        { metadata: { contains: device.deviceIdentifier } },
        { description: { contains: device.deviceIdentifier } },
      ],
    };

    // Fetch audit events related to this device
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              role: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      activity: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actionType: log.actionType,
        performedBy: log.student ? `${log.student.name} (${log.student.role})` : 'System',
        userRole: log.actorRole,
        description: log.description,
        details: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : null,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update Device Last Seen & Real Online Status (called on biometric event ingestion)
   */
  public async updateDeviceLastSeen(deviceIdentifier: string) {
    try {
      const cleanId = deviceIdentifier.trim();
      const device = await prisma.biometricDevice.findUnique({
        where: { deviceIdentifier: cleanId },
      });

      if (device && device.isEnabled && device.status !== 'MAINTENANCE') {
        await prisma.biometricDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            status: 'ONLINE',
          },
        });
      }
    } catch (err) {
      // Non-blocking for ingestion pipeline
      console.warn(`Could not update lastSeenAt for device ${deviceIdentifier}:`, err);
    }
  }

  /**
   * Seed Baseline Devices if table is empty
   */
  public async seedDefaultDevicesIfEmpty() {
    const count = await prisma.biometricDevice.count();
    if (count > 0) return;

    const initialDevices = [
      {
        deviceIdentifier: 'DEV-GATE-01',
        name: 'Main Gate Entry Turnstile #1',
        deviceType: 'TURNSTILE',
        location: 'Hostel Main Gate',
        description: 'Biometric optical turnstile for residential entry scans',
        status: 'ONLINE',
        isEnabled: true,
        lastSeenAt: new Date(),
        ipAddress: '192.168.10.101',
        macAddress: '00:1B:44:11:3A:B7',
        firmwareVersion: 'v2.4.12',
      },
      {
        deviceIdentifier: 'DEV-GATE-02',
        name: 'Main Gate Exit Turnstile #2',
        deviceType: 'TURNSTILE',
        location: 'Hostel Main Gate',
        description: 'Biometric turnstile for departure gate tracking and pass verification',
        status: 'ONLINE',
        isEnabled: true,
        lastSeenAt: new Date(),
        ipAddress: '192.168.10.102',
        macAddress: '00:1B:44:11:3A:B8',
        firmwareVersion: 'v2.4.12',
      },
      {
        deviceIdentifier: 'DEV-GATE-03',
        name: 'North Gate Perimeter Scanner',
        deviceType: 'GATE_READER',
        location: 'North Gate',
        description: 'Secondary emergency and service vehicle gate access reader',
        status: 'ONLINE',
        isEnabled: true,
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
        ipAddress: '192.168.10.103',
        macAddress: '00:1B:44:11:3A:C1',
        firmwareVersion: 'v2.3.0',
      },
      {
        deviceIdentifier: 'DEV-MESS-01',
        name: 'Mess Dining Hall Biometric Terminal',
        deviceType: 'BIOMETRIC',
        location: 'Mess Dining Hall',
        description: 'Multi-spectral fingerprint sensor for resident meal token verification',
        status: 'ONLINE',
        isEnabled: true,
        lastSeenAt: new Date(),
        ipAddress: '192.168.20.15',
        macAddress: '00:1B:44:22:8F:01',
        firmwareVersion: 'v3.1.0',
      },
      {
        deviceIdentifier: 'DEV-BLOCK-A',
        name: 'Block A Residential RFID Controller',
        deviceType: 'RFID',
        location: 'Block A Entrance',
        description: 'RFID door access controller for residential wing corridor',
        status: 'MAINTENANCE',
        isEnabled: true,
        lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        maintenanceNotes: 'Card reader sensor scheduled for antenna replacement',
        lastMaintenanceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        ipAddress: '192.168.30.22',
        macAddress: '00:1B:44:33:4C:90',
        firmwareVersion: 'v1.8.4',
      },
    ];

    for (const dev of initialDevices) {
      const apiKey = this.generateSecureApiKey();
      await prisma.biometricDevice.create({
        data: {
          ...dev,
          apiKeyHash: this.hashApiKey(apiKey),
          keyLastRotatedAt: new Date(),
        },
      });
    }

    console.log(`[DeviceService] Seeded ${initialDevices.length} authoritative baseline devices.`);
  }
}

export const deviceService = new DeviceService();
