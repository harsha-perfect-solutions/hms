import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagementOrMaintenance,
  requireRoles,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { notificationService } from '../services/notification.service';
import { storageService } from '../services/storage.service';

const router = Router();

// All complaint-management endpoints require at minimum management-or-maintenance auth
router.use(authenticateManagementOrMaintenance);

/* ============================================================
   VALID STATE MACHINE
   ============================================================
   OPEN → ASSIGNED        (assign  — WARDEN/ADMIN)
   ASSIGNED → IN_PROGRESS (start   — MAINTENANCE_STAFF)
   IN_PROGRESS → RESOLVED (resolve — MAINTENANCE_STAFF or WARDEN/ADMIN)
   RESOLVED → CLOSED      (close   — WARDEN/ADMIN)
   Student: OPEN → CANCELLED (student cancel — handled in complaint.routes.ts)
   ============================================================ */

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
};

function canTransition(fromStatus: string, toStatus: string): boolean {
  return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

/* ============================================================
   GET /api/management/complaints/stats
   KPI counts from PostgreSQL
   ============================================================ */
router.get('/stats', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const user = req.managementUser!;
    const isMaintenance = user.role === 'MAINTENANCE_STAFF';

    const whereBase = isMaintenance
      ? { assignedToId: user.id }
      : {};

    const [total, open, assigned, inProgress, resolved, closed, highPriority, unassigned] =
      await Promise.all([
        prisma.complaint.count({ where: whereBase }),
        prisma.complaint.count({ where: { ...whereBase, status: 'OPEN' } }),
        prisma.complaint.count({ where: { ...whereBase, status: 'ASSIGNED' } }),
        prisma.complaint.count({ where: { ...whereBase, status: 'IN_PROGRESS' } }),
        prisma.complaint.count({ where: { ...whereBase, status: 'RESOLVED' } }),
        prisma.complaint.count({ where: { ...whereBase, status: 'CLOSED' } }),
        prisma.complaint.count({
          where: { ...whereBase, priority: { in: ['HIGH', 'URGENT'] }, status: { notIn: ['CLOSED', 'CANCELLED', 'REJECTED'] } },
        }),
        isMaintenance
          ? Promise.resolve(0)
          : prisma.complaint.count({ where: { assignedToId: null, status: { notIn: ['CLOSED', 'CANCELLED', 'REJECTED'] } } }),
      ]);

    res.json({
      success: true,
      data: { total, open, assigned, inProgress, resolved, closed, highPriority, unassigned },
    });
  } catch (error) {
    console.error('Error fetching complaint stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaint statistics.' });
  }
});

/* ============================================================
   GET /api/management/complaints/maintenance-staff
   List all users with MAINTENANCE_STAFF role for assignment dropdowns
   ============================================================ */
router.get(
  '/maintenance-staff',
  requireRoles(...MANAGEMENT_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const staff = await prisma.student.findMany({
        where: { role: 'MAINTENANCE_STAFF', isActive: true },
        select: { id: true, name: true, jntuNo: true, email: true, role: true },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: staff });
    } catch (error) {
      console.error('Error fetching maintenance staff:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve maintenance staff.' });
    }
  }
);

/* ============================================================
   GET /api/management/complaints
   Paginated complaint list with filters
   ============================================================ */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const user = req.managementUser!;
    const isMaintenance = user.role === 'MAINTENANCE_STAFF';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { status, priority, category, assigned, search } = req.query as Record<string, string>;

    const where: any = {};

    // MAINTENANCE_STAFF sees only complaints assigned to them
    if (isMaintenance) {
      where.assignedToId = user.id;
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    // Priority filter
    if (priority && priority !== 'ALL') {
      where.priority = priority.toUpperCase();
    }

    // Category filter
    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    // Assigned filter (management only)
    if (!isMaintenance && assigned === 'unassigned') {
      where.assignedToId = null;
    } else if (!isMaintenance && assigned === 'assigned') {
      where.assignedToId = { not: null };
    }

    // Search (ticket number, title, student name)
    if (search && search.trim().length > 0) {
      const s = search.trim();
      where.OR = [
        { ticketNumber: { contains: s, mode: 'insensitive' } },
        { title: { contains: s, mode: 'insensitive' } },
        { student: { name: { contains: s, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          student: {
            select: { id: true, name: true, jntuNo: true, blockName: true, roomNumber: true },
          },
          attachments: {
            select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error listing complaints:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaints.' });
  }
});

/* ============================================================
   GET /api/management/complaints/:id
   Full complaint detail
   ============================================================ */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.managementUser!;
    const isMaintenance = user.role === 'MAINTENANCE_STAFF';

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true, name: true, jntuNo: true, email: true,
            blockName: true, floorName: true, roomNumber: true, bedNumber: true,
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    // MAINTENANCE_STAFF: can only view complaints assigned to them
    if (isMaintenance && complaint.assignedToId !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied. This complaint is not assigned to you.' });
      return;
    }

    // Format attachments with management download URL
    const formattedAttachments = complaint.attachments.map((att) => ({
      id: att.id,
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      createdAt: att.createdAt,
      downloadUrl: `/api/management/complaints/${id}/attachments/${att.id}`,
    }));

    let parsedComments: any[] = [];
    if (complaint.comments) {
      try { parsedComments = JSON.parse(complaint.comments); } catch { parsedComments = []; }
    }

    res.json({
      success: true,
      data: {
        ...complaint,
        attachments: formattedAttachments,
        commentsList: parsedComments,
      },
    });
  } catch (error) {
    console.error('Error fetching complaint detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaint.' });
  }
});

/* ============================================================
   GET /api/management/complaints/:id/attachments/:attachmentId
   Secure authenticated attachment download for management
   ============================================================ */
router.get(
  '/:id/attachments/:attachmentId',
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id, attachmentId } = req.params;
      const user = req.managementUser!;
      const isMaintenance = user.role === 'MAINTENANCE_STAFF';

      const complaint = await prisma.complaint.findUnique({ where: { id } });
      if (!complaint) {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }

      // MAINTENANCE_STAFF can only view attachments on their assigned complaints
      if (isMaintenance && complaint.assignedToId !== user.id) {
        res.status(403).json({ success: false, message: 'Access denied.' });
        return;
      }

      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, complaintId: id },
      });

      if (!attachment) {
        res.status(404).json({ success: false, message: 'Attachment not found.' });
        return;
      }

      const safeFilePath = storageService.getFilePath(attachment.storedName);
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(safeFilePath);
    } catch (error: any) {
      console.error('Error streaming management attachment:', error);
      res.status(404).json({ success: false, message: error.message || 'File not accessible.' });
    }
  }
);

/* ============================================================
   POST /api/management/complaints/:id/assign
   Assign complaint to a MAINTENANCE_STAFF member
   OPEN → ASSIGNED
   Restricted to: WARDEN, CHIEF_WARDEN, ADMIN, HOSTEL_ADMIN
   ============================================================ */
router.post(
  '/:id/assign',
  requireRoles(...MANAGEMENT_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { staffId } = req.body;
    const actor = req.managementUser!;

    if (!staffId || typeof staffId !== 'string') {
      res.status(400).json({ success: false, message: 'Staff member ID is required.' });
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Re-read complaint under transaction
        const complaint = await tx.complaint.findUnique({
          where: { id },
          include: { student: true },
        });

        if (!complaint) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });

        // State machine: only OPEN can be assigned
        if (!canTransition(complaint.status, 'ASSIGNED')) {
          throw Object.assign(
            new Error(`INVALID_TRANSITION: Cannot assign a complaint with status "${complaint.status}". Only OPEN complaints can be assigned.`),
            { status: 400 }
          );
        }

        // Validate staff exists and has MAINTENANCE_STAFF role
        const staff = await tx.student.findUnique({ where: { id: staffId } });
        if (!staff) throw Object.assign(new Error('STAFF_NOT_FOUND: Maintenance staff member not found.'), { status: 404 });
        if (staff.role !== 'MAINTENANCE_STAFF') {
          throw Object.assign(
            new Error('INVALID_STAFF_ROLE: Only users with the MAINTENANCE_STAFF role can be assigned to complaints.'),
            { status: 400 }
          );
        }
        if (!staff.isActive) {
          throw Object.assign(new Error('STAFF_INACTIVE: The selected staff member account is currently inactive.'), { status: 400 });
        }

        const now = new Date();
        const updated = await tx.complaint.update({
          where: { id },
          data: {
            status: 'ASSIGNED',
            assignedToId: staff.id,
            assignedTo: staff.name,
            assignedAt: now,
            assignedBy: actor.name,
          },
        });

        await tx.activityLog.create({
          data: {
            studentId: complaint.studentId,
            actionType: 'COMPLAINT',
            description: `Complaint ${complaint.ticketNumber || complaint.id} assigned to ${staff.name} by ${actor.name}.`,
          },
        });

        await notificationService.createNotification(
          {
            studentId: complaint.studentId,
            title: 'Complaint Assigned',
            message: `Your complaint ${complaint.ticketNumber || complaint.id} has been assigned to a maintenance technician (${staff.name}).`,
            type: 'INFO',
            category: 'COMPLAINT',
            entityId: complaint.id,
            link: '/complaints',
          },
          tx
        );

        return { updated, student: complaint.student, staff };
      });

      // SSE post-commit
      complaintEventsService.emitToStudent(result.student.id, {
        type: 'COMPLAINT_ASSIGNED',
        complaintId: id,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Complaint assigned to ${result.staff.name} successfully.`,
        data: {
          id: result.updated.id,
          status: result.updated.status,
          assignedTo: result.updated.assignedTo,
          assignedToId: result.updated.assignedToId,
          assignedAt: result.updated.assignedAt,
          assignedBy: result.updated.assignedBy,
        },
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }
      if (error.message?.startsWith('STAFF_NOT_FOUND')) {
        res.status(404).json({ success: false, message: error.message.split(': ')[1] });
        return;
      }
      if (error.message?.startsWith('INVALID_TRANSITION') || error.message?.startsWith('INVALID_STAFF_ROLE') || error.message?.startsWith('STAFF_INACTIVE')) {
        res.status(400).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      console.error('Error assigning complaint:', error);
      res.status(500).json({ success: false, message: 'Failed to assign complaint.' });
    }
  }
);

/* ============================================================
   POST /api/management/complaints/:id/start
   Start work on assigned complaint
   ASSIGNED → IN_PROGRESS
   Restricted to: MAINTENANCE_STAFF (must be assigned staff)
   ============================================================ */
router.post(
  '/:id/start',
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const actor = req.managementUser!;

    // Only MAINTENANCE_STAFF can start work; WARDEN/ADMIN cannot start on behalf
    if (actor.role !== 'MAINTENANCE_STAFF') {
      res.status(403).json({
        success: false,
        message: 'Only the assigned maintenance staff member can start work on a complaint.',
      });
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
          where: { id },
          include: { student: true },
        });

        if (!complaint) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });

        if (!canTransition(complaint.status, 'IN_PROGRESS')) {
          throw Object.assign(
            new Error(`INVALID_TRANSITION: Cannot start work on a complaint with status "${complaint.status}".`),
            { status: 400 }
          );
        }

        // Must be assigned to this specific staff member
        if (complaint.assignedToId !== actor.id) {
          throw Object.assign(
            new Error('NOT_ASSIGNED: This complaint is not assigned to you.'),
            { status: 403 }
          );
        }

        const updated = await tx.complaint.update({
          where: { id },
          data: { status: 'IN_PROGRESS' },
        });

        await tx.activityLog.create({
          data: {
            studentId: complaint.studentId,
            actionType: 'COMPLAINT',
            description: `Work started on complaint ${complaint.ticketNumber || complaint.id} by ${actor.name}.`,
          },
        });

        await notificationService.createNotification(
          {
            studentId: complaint.studentId,
            title: 'Work Started on Your Complaint',
            message: `Maintenance work has begun on your complaint ${complaint.ticketNumber || complaint.id}.`,
            type: 'INFO',
            category: 'COMPLAINT',
            entityId: complaint.id,
            link: '/complaints',
          },
          tx
        );

        return { updated, student: complaint.student };
      });

      complaintEventsService.emitToStudent(result.student.id, {
        type: 'COMPLAINT_STARTED',
        complaintId: id,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Work started on complaint.',
        data: { id: result.updated.id, status: result.updated.status },
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }
      if (error.message?.startsWith('NOT_ASSIGNED')) {
        res.status(403).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      if (error.message?.startsWith('INVALID_TRANSITION')) {
        res.status(400).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      console.error('Error starting complaint:', error);
      res.status(500).json({ success: false, message: 'Failed to start work on complaint.' });
    }
  }
);

/* ============================================================
   POST /api/management/complaints/:id/resolve
   Resolve complaint with resolution notes
   IN_PROGRESS → RESOLVED
   Restricted to: MAINTENANCE_STAFF (assigned) or WARDEN/ADMIN
   ============================================================ */
router.post(
  '/:id/resolve',
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const actor = req.managementUser!;
    const isMaintenance = actor.role === 'MAINTENANCE_STAFF';

    if (!resolutionNotes || typeof resolutionNotes !== 'string' || resolutionNotes.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'Resolution notes are required (minimum 10 characters).',
      });
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
          where: { id },
          include: { student: true },
        });

        if (!complaint) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });

        if (!canTransition(complaint.status, 'RESOLVED')) {
          throw Object.assign(
            new Error(`INVALID_TRANSITION: Cannot resolve a complaint with status "${complaint.status}".`),
            { status: 400 }
          );
        }

        // MAINTENANCE_STAFF can only resolve their own assigned complaints
        if (isMaintenance && complaint.assignedToId !== actor.id) {
          throw Object.assign(new Error('NOT_ASSIGNED: This complaint is not assigned to you.'), { status: 403 });
        }

        const now = new Date();
        const updated = await tx.complaint.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            resolutionNotes: resolutionNotes.trim(),
            resolvedBy: actor.name,
            resolvedAt: now,
          },
        });

        await tx.activityLog.create({
          data: {
            studentId: complaint.studentId,
            actionType: 'COMPLAINT',
            description: `Complaint ${complaint.ticketNumber || complaint.id} resolved by ${actor.name}.`,
          },
        });

        await notificationService.createNotification(
          {
            studentId: complaint.studentId,
            title: 'Complaint Resolved',
            message: `Your complaint ${complaint.ticketNumber || complaint.id} has been resolved. Notes: ${resolutionNotes.trim().substring(0, 100)}`,
            type: 'SUCCESS',
            category: 'COMPLAINT',
            entityId: complaint.id,
            link: '/complaints',
          },
          tx
        );

        return { updated, student: complaint.student };
      });

      complaintEventsService.emitToStudent(result.student.id, {
        type: 'COMPLAINT_RESOLVED',
        complaintId: id,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Complaint resolved successfully.',
        data: {
          id: result.updated.id,
          status: result.updated.status,
          resolutionNotes: result.updated.resolutionNotes,
          resolvedBy: result.updated.resolvedBy,
          resolvedAt: result.updated.resolvedAt,
        },
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }
      if (error.message?.startsWith('NOT_ASSIGNED')) {
        res.status(403).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      if (error.message?.startsWith('INVALID_TRANSITION')) {
        res.status(400).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      console.error('Error resolving complaint:', error);
      res.status(500).json({ success: false, message: 'Failed to resolve complaint.' });
    }
  }
);

/* ============================================================
   POST /api/management/complaints/:id/close
   Close resolved complaint
   RESOLVED → CLOSED
   Restricted to: WARDEN, CHIEF_WARDEN, ADMIN, HOSTEL_ADMIN
   ============================================================ */
router.post(
  '/:id/close',
  requireRoles(...MANAGEMENT_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const actor = req.managementUser!;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
          where: { id },
          include: { student: true },
        });

        if (!complaint) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });

        if (!canTransition(complaint.status, 'CLOSED')) {
          throw Object.assign(
            new Error(`INVALID_TRANSITION: Cannot close a complaint with status "${complaint.status}". Only RESOLVED complaints can be closed.`),
            { status: 400 }
          );
        }

        const now = new Date();
        const updated = await tx.complaint.update({
          where: { id },
          data: {
            status: 'CLOSED',
            closedAt: now,
            closedBy: actor.name,
          },
        });

        await tx.activityLog.create({
          data: {
            studentId: complaint.studentId,
            actionType: 'COMPLAINT',
            description: `Complaint ${complaint.ticketNumber || complaint.id} closed by ${actor.name}.`,
          },
        });

        await notificationService.createNotification(
          {
            studentId: complaint.studentId,
            title: 'Complaint Closed',
            message: `Your complaint ${complaint.ticketNumber || complaint.id} has been officially closed by the hostel administration.`,
            type: 'SUCCESS',
            category: 'COMPLAINT',
            entityId: complaint.id,
            link: '/complaints',
          },
          tx
        );

        return { updated, student: complaint.student };
      });

      complaintEventsService.emitToStudent(result.student.id, {
        type: 'COMPLAINT_CLOSED',
        complaintId: id,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Complaint closed successfully.',
        data: {
          id: result.updated.id,
          status: result.updated.status,
          closedAt: result.updated.closedAt,
          closedBy: result.updated.closedBy,
        },
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Complaint not found.' });
        return;
      }
      if (error.message?.startsWith('INVALID_TRANSITION')) {
        res.status(400).json({ success: false, message: error.message.split(': ')[1] || error.message });
        return;
      }
      console.error('Error closing complaint:', error);
      res.status(500).json({ success: false, message: 'Failed to close complaint.' });
    }
  }
);

export default router;
