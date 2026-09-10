import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma.service';
import { complaintEventsService } from './events.service';

export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface CreateAuditLogParams {
  actorId: string;
  actorRole?: string | null;
  action: string;
  actionType?: string;
  entity: string;
  entityId?: string | null;
  previousState?: string | Record<string, any> | null;
  newState?: string | Record<string, any> | null;
  description: string;
  metadata?: Record<string, any> | string | null;
  ipAddress?: string | null;
}

/**
 * Sanitizes arbitrary metadata objects to strictly purge sensitive credentials,
 * passwords, JWT tokens, session hashes, and biometric templates.
 */
export function sanitizeAuditMetadata(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;

  const SENSITIVE_KEYS = [
    'password',
    'passwordhash',
    'token',
    'refreshtoken',
    'jwt',
    'secret',
    'jwtsecret',
    'biometrictemplate',
    'fingerprinttemplate',
    'faceembedding',
    'cookie',
    'authorization',
  ];

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditMetadata(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Formats a state value (string or object) safely into a string
 */
function serializeState(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(sanitizeAuditMetadata(val));
  } catch {
    return String(val);
  }
}

/**
 * Authoritative Central Audit Service for HMS
 */
class AuditService {
  /**
   * Records an authoritative audit log entry into PostgreSQL 18.6.
   * Can be executed within an active Prisma interactive transaction (tx)
   * or directly on the global Prisma client.
   *
   * @param params Audit parameters
   * @param tx Optional interactive transaction client
   * @param emitRealtime Whether to emit the real-time SSE event immediately (set false if inside tx and emit after commit)
   */
  async recordLog(
    params: CreateAuditLogParams,
    tx?: PrismaTransaction,
    emitRealtime = true
  ) {
    const client = tx || prisma;

    // Resolve actor role if not explicitly provided
    let resolvedRole = params.actorRole;
    if (!resolvedRole && params.actorId) {
      try {
        const actor = await prisma.student.findUnique({
          where: { id: params.actorId },
          select: { role: true },
        });
        if (actor) {
          resolvedRole = actor.role;
        }
      } catch {
        // Fallback gracefully
      }
    }

    const previousStateStr = serializeState(params.previousState);
    const newStateStr = serializeState(params.newState);

    let metadataStr: string | null = null;
    if (params.metadata) {
      try {
        if (typeof params.metadata === 'string') {
          // If already string, try to parse and sanitize
          try {
            const parsed = JSON.parse(params.metadata);
            metadataStr = JSON.stringify(sanitizeAuditMetadata(parsed));
          } catch {
            metadataStr = params.metadata;
          }
        } else {
          metadataStr = JSON.stringify(sanitizeAuditMetadata(params.metadata));
        }
      } catch {
        metadataStr = null;
      }
    }

    const actionTypeVal = params.actionType || params.action || 'SYSTEM';

    const logEntry = await client.activityLog.create({
      data: {
        studentId: params.actorId,
        actionType: actionTypeVal,
        action: params.action,
        actorRole: resolvedRole || 'UNKNOWN',
        entity: params.entity,
        entityId: params.entityId || null,
        previousState: previousStateStr,
        newState: newStateStr,
        description: params.description,
        metadata: metadataStr,
        ipAddress: params.ipAddress || null,
      },
    });

    if (emitRealtime && !tx) {
      this.emitAuditEvent(logEntry);
    }

    return logEntry;
  }

  /**
   * Dispatches the real-time SSE event to all connected management dashboards
   * Strictly called AFTER the PostgreSQL transaction has committed.
   */
  emitAuditEvent(logEntry: any) {
    try {
      complaintEventsService.emitManagementDashboardUpdate({
        type: 'AUDIT_LOG_CREATED',
        timestamp: new Date().toISOString(),
        details: {
          id: logEntry.id,
          action: logEntry.action,
          entity: logEntry.entity,
          actorRole: logEntry.actorRole,
          description: logEntry.description,
          createdAt: logEntry.createdAt,
        },
      });
    } catch (err) {
      console.error('Failed to emit AUDIT_LOG_CREATED event:', err);
    }
  }
}

export const auditService = new AuditService();
