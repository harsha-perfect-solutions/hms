import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
} from '../middleware/management.middleware';

const router = Router();

// Apply strict management authentication to all log history routes
router.use(authenticateManagement);

/**
 * GET /api/management/log-history/summary
 * Returns high-level operational activity metrics for management KPI cards
 */
router.get('/summary', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalLogs,
      todayLogs,
      approvalLogs,
      financialLogs,
      securityLogs,
      adminLogs,
    ] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.activityLog.count({
        where: {
          OR: [
            { action: { in: ['APPROVE', 'REJECT'] } },
            { actionType: { in: ['APPROVE', 'REJECT'] } },
            { description: { contains: 'Approved', mode: 'insensitive' } },
            { description: { contains: 'Rejected', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.activityLog.count({
        where: {
          OR: [
            { entity: { in: ['GuestBill', 'GuestPayment', 'BillingItem'] } },
            { action: { in: ['PAYMENT_RECORDED', 'VOID'] } },
            { actionType: { in: ['GUEST_BILLING', 'PAYMENT', 'VOID'] } },
            { description: { contains: 'Payment', mode: 'insensitive' } },
            { description: { contains: 'Bill', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.activityLog.count({
        where: {
          OR: [
            { entity: { in: ['BiometricEvent', 'Session', 'Suspension'] } },
            { action: { in: ['LOGIN', 'LOGOUT', 'SUSPEND', 'LIFT_SUSPENSION', 'ENTRY', 'EXIT'] } },
            { actionType: { in: ['BIOMETRIC', 'SECURITY', 'LOGIN', 'SUSPENSION'] } },
          ],
        },
      }),
      prisma.activityLog.count({
        where: {
          actorRole: { in: ['ADMIN', 'HOSTEL_ADMIN', 'CHIEF_WARDEN', 'WARDEN'] },
        },
      }),
    ]);

    res.json({
      success: true,
      summary: {
        totalLogs,
        todayLogs,
        approvalLogs,
        financialLogs,
        securityLogs,
        adminLogs,
      },
    });
  } catch (err: any) {
    console.error('Error fetching log history summary:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve log history summary metrics.',
    });
  }
});

/**
 * GET /api/management/log-history
 * Paginated, multi-filter search across authoritative activity logs
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const rawLimit = parseInt(String(req.query.pageSize || req.query.limit || '25'), 10) || 25;
    const pageSize = Math.min(100, Math.max(1, rawLimit)); // Safe bounds: 1 to 100

    const {
      action,
      entity,
      actorRole,
      actorId,
      from,
      to,
      startDate,
      endDate,
      search,
    } = req.query;

    const where: any = {};

    // Action filter
    if (typeof action === 'string' && action.trim() && action.toUpperCase() !== 'ALL') {
      const act = action.trim().toUpperCase();
      where.OR = [
        { action: act },
        { actionType: act },
      ];
    }

    // Entity filter
    if (typeof entity === 'string' && entity.trim() && entity.toUpperCase() !== 'ALL') {
      where.entity = entity.trim();
    }

    // Actor Role filter
    if (typeof actorRole === 'string' && actorRole.trim() && actorRole.toUpperCase() !== 'ALL') {
      where.actorRole = actorRole.trim().toUpperCase();
    }

    // Actor ID filter
    if (typeof actorId === 'string' && actorId.trim()) {
      where.studentId = actorId.trim();
    }

    // Date range filter
    const fromDateStr = from || startDate;
    const toDateStr = to || endDate;
    if (fromDateStr || toDateStr) {
      where.createdAt = {};
      if (typeof fromDateStr === 'string' && fromDateStr.trim()) {
        const fromDate = new Date(fromDateStr.trim());
        if (!isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }
      if (typeof toDateStr === 'string' && toDateStr.trim()) {
        const toDate = new Date(toDateStr.trim());
        if (!isNaN(toDate.getTime())) {
          // If just a date string (YYYY-MM-DD), expand to end of day
          if (toDateStr.trim().length === 10) {
            toDate.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = toDate;
        }
      }
    }

    // Text search filter
    if (typeof search === 'string' && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { description: { contains: q, mode: 'insensitive' as const } },
        { entityId: { contains: q, mode: 'insensitive' as const } },
        { entity: { contains: q, mode: 'insensitive' as const } },
        { action: { contains: q, mode: 'insensitive' as const } },
        { student: { name: { contains: q, mode: 'insensitive' as const } } },
        { student: { jntuNo: { contains: q, mode: 'insensitive' as const } } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              role: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        studentId: log.studentId,
        actor: {
          id: log.student.id,
          name: log.student.name,
          jntuNo: log.student.jntuNo,
          role: log.actorRole || log.student.role,
          email: log.student.email,
        },
        actorRole: log.actorRole || log.student.role,
        action: log.action || log.actionType,
        actionType: log.actionType,
        entity: log.entity || 'System',
        entityId: log.entityId,
        previousState: log.previousState,
        newState: log.newState,
        description: log.description,
        metadata: log.metadata ? safeJsonParse(log.metadata) : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error('Error querying log history:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve log history records.',
    });
  }
});

/**
 * GET /api/management/log-history/:id
 * Detailed view of an individual audit log record
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const log = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            role: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Audit log record not found.',
      });
      return;
    }

    res.json({
      success: true,
      log: {
        id: log.id,
        studentId: log.studentId,
        actor: {
          id: log.student.id,
          name: log.student.name,
          jntuNo: log.student.jntuNo,
          role: log.actorRole || log.student.role,
          email: log.student.email,
        },
        actorRole: log.actorRole || log.student.role,
        action: log.action || log.actionType,
        actionType: log.actionType,
        entity: log.entity || 'System',
        entityId: log.entityId,
        previousState: log.previousState,
        newState: log.newState,
        description: log.description,
        metadata: log.metadata ? safeJsonParse(log.metadata) : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Error retrieving audit log detail:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log details.',
    });
  }
});

function safeJsonParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export default router;
