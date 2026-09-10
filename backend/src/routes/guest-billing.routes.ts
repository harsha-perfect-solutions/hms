import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';

const router = Router();

// Apply management authentication and RBAC to all guest billing routes
router.use(authenticateManagement);

/**
 * Generate a unique bill number: GB-YYYYMMDD-XXXX
 */
async function generateUniqueBillNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let i = 0; i < 10; i++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `GB-${dateStr}-${randomSuffix}`;
    const exists = await prisma.guestBill.findUnique({ where: { billNumber: candidate } });
    if (!exists) return candidate;
  }
  return `GB-${dateStr}-${Date.now().toString().slice(-6)}`;
}

// ==========================================
// 1. OVERVIEW / KPI STATS
// ==========================================

/**
 * GET /api/management/guest-billing/overview
 * Authoritative summary KPIs for guest billing management
 */
router.get('/overview', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalGuests,
      todayVisits,
      activeVisits,
      bills,
    ] = await Promise.all([
      prisma.guest.count(),
      prisma.guestVisit.count({
        where: {
          visitDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.guestVisit.count({
        where: {
          status: 'CHECKED_IN',
        },
      }),
      prisma.guestBill.findMany({
        where: {
          paymentStatus: { not: 'VOID' },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          paymentStatus: true,
        },
      }),
    ]);

    let totalBills = bills.length;
    let unpaidAmount = 0;
    let paidAmount = 0;

    for (const b of bills) {
      paidAmount += b.paidAmount || 0;
      if (b.paymentStatus === 'UNPAID' || b.paymentStatus === 'PARTIALLY_PAID') {
        unpaidAmount += b.balanceAmount || 0;
      }
    }

    res.json({
      success: true,
      stats: {
        totalGuests,
        todayVisits,
        activeVisits,
        totalBills,
        unpaidAmount: Math.round(unpaidAmount * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching guest billing overview stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve overview stats.' });
  }
});

// ==========================================
// 2. HOST / STUDENT LOOKUP
// ==========================================

/**
 * GET /api/management/guest-billing/hosts
 * Searchable active students who can host guests
 */
router.get('/hosts', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const where: any = {
      role: 'STUDENT',
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { jntuNo: { contains: search, mode: 'insensitive' } },
        { roomNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const hosts = await prisma.student.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        jntuNo: true,
        email: true,
        blockName: true,
        roomNumber: true,
        bedNumber: true,
      },
    });

    res.json({ success: true, hosts });
  } catch (error) {
    console.error('Error looking up host students:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve host student records.' });
  }
});

// ==========================================
// 3. GUEST RECORDS
// ==========================================

/**
 * GET /api/management/guest-billing/guests
 * List guests with search and pagination
 */
router.get('/guests', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { idProofNumber: { contains: search, mode: 'insensitive' } },
        { relation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, guests] = await Promise.all([
      prisma.guest.count({ where }),
      prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { visits: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      guests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve guests.' });
  }
});

/**
 * GET /api/management/guest-billing/guests/:id
 * Retrieve guest details with visit history
 */
router.get('/guests/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        visits: {
          orderBy: { visitDate: 'desc' },
          include: {
            hostStudent: {
              select: {
                id: true,
                name: true,
                jntuNo: true,
                blockName: true,
                roomNumber: true,
              },
            },
            bills: true,
          },
        },
      },
    });

    if (!guest) {
      res.status(404).json({ success: false, message: 'Guest record not found.' });
      return;
    }

    res.json({ success: true, guest });
  } catch (error) {
    console.error('Error fetching guest detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve guest detail.' });
  }
});

/**
 * POST /api/management/guest-billing/guests
 * Register a new guest record
 */
router.post('/guests', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, email, idProofType, idProofNumber, address, relation } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!trimmedName || trimmedName.length < 2) {
      res.status(400).json({ success: false, message: 'Guest name is required (minimum 2 characters).' });
      return;
    }

    if (!trimmedPhone || trimmedPhone.length < 7 || trimmedPhone.length > 15) {
      res.status(400).json({ success: false, message: 'Valid guest phone number is required (7 to 15 digits).' });
      return;
    }

    const [newGuest] = await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({
        data: {
          name: trimmedName,
          phone: trimmedPhone,
          email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
          idProofType: typeof idProofType === 'string' && idProofType.trim() ? idProofType.trim().toUpperCase() : null,
          idProofNumber: typeof idProofNumber === 'string' && idProofNumber.trim() ? idProofNumber.trim().toUpperCase() : null,
          address: typeof address === 'string' && address.trim() ? address.trim() : null,
          relation: typeof relation === 'string' && relation.trim() ? relation.trim().toUpperCase() : null,
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'GUEST_MANAGEMENT',
          action: 'CREATE',
          actorRole: req.managementUser!.role,
          entity: 'Guest',
          entityId: guest.id,
          newState: guest.name,
          description: `Guest '${trimmedName}' (Phone: ${trimmedPhone}) registered by ${req.managementUser!.name}.`,
        },
      });

      return [guest];
    });

    // Real-time SSE dispatch after transaction commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_CREATED',
      timestamp: new Date().toISOString(),
      details: { guestId: newGuest.id, name: newGuest.name },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Guest registered successfully.',
      guest: newGuest,
    });
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({ success: false, message: 'Failed to create guest record.' });
  }
});

/**
 * PUT /api/management/guest-billing/guests/:id
 * Update guest details
 */
router.put('/guests/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, email, idProofType, idProofNumber, address, relation } = req.body;

    const existing = await prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Guest record not found.' });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName || trimmedName.length < 2) {
        res.status(400).json({ success: false, message: 'Guest name cannot be empty.' });
        return;
      }
      updateData.name = trimmedName;
    }

    if (phone !== undefined) {
      const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
      if (!trimmedPhone || trimmedPhone.length < 7 || trimmedPhone.length > 15) {
        res.status(400).json({ success: false, message: 'Valid phone number is required.' });
        return;
      }
      updateData.phone = trimmedPhone;
    }

    if (email !== undefined) {
      updateData.email = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    }

    if (idProofType !== undefined) {
      updateData.idProofType = typeof idProofType === 'string' && idProofType.trim() ? idProofType.trim().toUpperCase() : null;
    }

    if (idProofNumber !== undefined) {
      updateData.idProofNumber = typeof idProofNumber === 'string' && idProofNumber.trim() ? idProofNumber.trim().toUpperCase() : null;
    }

    if (address !== undefined) {
      updateData.address = typeof address === 'string' && address.trim() ? address.trim() : null;
    }

    if (relation !== undefined) {
      updateData.relation = typeof relation === 'string' && relation.trim() ? relation.trim().toUpperCase() : null;
    }

    const [updatedGuest] = await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.update({
        where: { id },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'GUEST_MANAGEMENT',
          action: 'UPDATE',
          actorRole: req.managementUser!.role,
          entity: 'Guest',
          entityId: guest.id,
          previousState: existing.name,
          newState: guest.name,
          description: `Guest '${guest.name}' profile updated by ${req.managementUser!.name}.`,
        },
      });

      return [guest];
    });

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_UPDATED',
      timestamp: new Date().toISOString(),
      details: { guestId: updatedGuest.id },
    });

    res.json({
      success: true,
      message: 'Guest record updated successfully.',
      guest: updatedGuest,
    });
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ success: false, message: 'Failed to update guest record.' });
  }
});

// ==========================================
// 4. GUEST VISITS & CHECKOUT
// ==========================================

/**
 * GET /api/management/guest-billing/visits
 * List visits with search, status, and date filters
 */
router.get('/visits', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';
    const guestId = typeof req.query.guestId === 'string' ? req.query.guestId.trim() : undefined;
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : undefined;
    const dateStr = typeof req.query.date === 'string' ? req.query.date.trim() : undefined;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (studentId) {
      where.hostStudentId = studentId;
    }

    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      where.visitDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (search) {
      where.OR = [
        { purpose: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        { guest: { name: { contains: search, mode: 'insensitive' } } },
        { guest: { phone: { contains: search, mode: 'insensitive' } } },
        { hostStudent: { name: { contains: search, mode: 'insensitive' } } },
        { hostStudent: { jntuNo: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, visits] = await Promise.all([
      prisma.guestVisit.count({ where }),
      prisma.guestVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkInTime: 'desc' },
        include: {
          guest: true,
          hostStudent: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              blockName: true,
              roomNumber: true,
            },
          },
          bills: {
            select: {
              id: true,
              billNumber: true,
              totalAmount: true,
              paidAmount: true,
              balanceAmount: true,
              paymentStatus: true,
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      visits,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve guest visits.' });
  }
});

/**
 * GET /api/management/guest-billing/visits/:id
 * Retrieve visit detail with guest, host student, and full bills
 */
router.get('/visits/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const visit = await prisma.guestVisit.findUnique({
      where: { id },
      include: {
        guest: true,
        hostStudent: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            email: true,
            blockName: true,
            roomNumber: true,
            bedNumber: true,
          },
        },
        bills: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (!visit) {
      res.status(404).json({ success: false, message: 'Visit record not found.' });
      return;
    }

    res.json({ success: true, visit });
  } catch (error) {
    console.error('Error fetching visit detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve visit detail.' });
  }
});

/**
 * POST /api/management/guest-billing/visits
 * Create and check-in a guest visit
 */
router.post('/visits', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { guestId, hostStudentId, purpose, checkInTime, remarks } = req.body;

    if (!guestId || typeof guestId !== 'string') {
      res.status(400).json({ success: false, message: 'Valid guest ID is required.' });
      return;
    }

    if (!hostStudentId || typeof hostStudentId !== 'string') {
      res.status(400).json({ success: false, message: 'Valid host student ID is required.' });
      return;
    }

    const trimmedPurpose = typeof purpose === 'string' ? purpose.trim() : '';
    if (!trimmedPurpose || trimmedPurpose.length < 2) {
      res.status(400).json({ success: false, message: 'Visit purpose is required.' });
      return;
    }

    // Verify Guest exists
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) {
      res.status(404).json({ success: false, message: 'Specified guest does not exist.' });
      return;
    }

    // Verify Host Student exists
    const hostStudent = await prisma.student.findUnique({
      where: { id: hostStudentId },
      select: { id: true, name: true, jntuNo: true, role: true, isActive: true },
    });
    if (!hostStudent) {
      res.status(404).json({ success: false, message: 'Host student does not exist.' });
      return;
    }

    const checkInDate = checkInTime ? new Date(checkInTime) : new Date();
    if (isNaN(checkInDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid check-in timestamp format.' });
      return;
    }

    const [newVisit] = await prisma.$transaction(async (tx) => {
      const visit = await tx.guestVisit.create({
        data: {
          guestId,
          hostStudentId,
          purpose: trimmedPurpose,
          visitDate: checkInDate,
          checkInTime: checkInDate,
          status: 'CHECKED_IN',
          remarks: typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null,
        },
        include: {
          guest: true,
          hostStudent: {
            select: { id: true, name: true, jntuNo: true, blockName: true, roomNumber: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: hostStudentId,
          actionType: 'GUEST_VISIT',
          action: 'CHECKIN',
          actorRole: req.managementUser!.role,
          entity: 'GuestVisit',
          entityId: visit.id,
          newState: 'CHECKED_IN',
          description: `Guest '${guest.name}' checked in to visit resident ${hostStudent.name} (${hostStudent.jntuNo}). Purpose: ${trimmedPurpose}.`,
        },
      });

      return [visit];
    });

    // Real-time SSE dispatch after commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_VISIT_CREATED',
      timestamp: new Date().toISOString(),
      details: { visitId: newVisit.id, guestName: guest.name, hostStudentName: hostStudent.name },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Guest checked in successfully.',
      visit: newVisit,
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ success: false, message: 'Failed to create visit record.' });
  }
});

/**
 * PUT /api/management/guest-billing/visits/:id
 * Update visit purpose or remarks
 */
router.put('/visits/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { purpose, remarks } = req.body;

    const existing = await prisma.guestVisit.findUnique({
      where: { id },
      include: { guest: true, hostStudent: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Visit record not found.' });
      return;
    }

    const updateData: any = {};
    if (purpose !== undefined) {
      const trimmedPurpose = typeof purpose === 'string' ? purpose.trim() : '';
      if (!trimmedPurpose || trimmedPurpose.length < 2) {
        res.status(400).json({ success: false, message: 'Visit purpose cannot be empty.' });
        return;
      }
      updateData.purpose = trimmedPurpose;
    }

    if (remarks !== undefined) {
      updateData.remarks = typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null;
    }

    const [updatedVisit] = await prisma.$transaction(async (tx) => {
      const visit = await tx.guestVisit.update({
        where: { id },
        data: updateData,
        include: { guest: true, hostStudent: true },
      });

      await tx.activityLog.create({
        data: {
          studentId: existing.hostStudentId,
          actionType: 'GUEST_VISIT',
          description: `Visit details updated for guest '${existing.guest.name}' by ${req.managementUser!.name}.`,
        },
      });

      return [visit];
    });

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_VISIT_UPDATED',
      timestamp: new Date().toISOString(),
      details: { visitId: updatedVisit.id },
    });

    res.json({
      success: true,
      message: 'Visit updated successfully.',
      visit: updatedVisit,
    });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ success: false, message: 'Failed to update visit record.' });
  }
});

/**
 * POST /api/management/guest-billing/visits/:id/checkout
 * Check out an active guest visit
 */
router.post('/visits/:id/checkout', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { checkOutTime } = req.body;

    const existing = await prisma.guestVisit.findUnique({
      where: { id },
      include: { guest: true, hostStudent: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Visit record not found.' });
      return;
    }

    if (existing.status === 'CHECKED_OUT') {
      res.status(400).json({ success: false, message: 'Visit has already been checked out.' });
      return;
    }

    if (existing.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'Cannot checkout a cancelled visit.' });
      return;
    }

    const checkoutDate = checkOutTime ? new Date(checkOutTime) : new Date();
    if (isNaN(checkoutDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid check-out timestamp format.' });
      return;
    }

    if (checkoutDate.getTime() < new Date(existing.checkInTime).getTime()) {
      res.status(400).json({
        success: false,
        message: 'Check-out time cannot be earlier than check-in time.',
      });
      return;
    }

    const [updatedVisit] = await prisma.$transaction(async (tx) => {
      const visit = await tx.guestVisit.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          checkOutTime: checkoutDate,
        },
        include: { guest: true, hostStudent: true },
      });

      await tx.activityLog.create({
        data: {
          studentId: existing.hostStudentId,
          actionType: 'GUEST_VISIT',
          action: 'CHECKOUT',
          actorRole: req.managementUser!.role,
          entity: 'GuestVisit',
          entityId: visit.id,
          previousState: 'CHECKED_IN',
          newState: 'CHECKED_OUT',
          description: `Guest '${existing.guest.name}' checked out at ${checkoutDate.toLocaleTimeString()} by ${req.managementUser!.name}.`,
        },
      });

      return [visit];
    });

    // Real-time SSE dispatch after commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_CHECKED_OUT',
      timestamp: new Date().toISOString(),
      details: { visitId: updatedVisit.id, guestName: existing.guest.name },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Guest checked out successfully.',
      visit: updatedVisit,
    });
  } catch (error) {
    console.error('Error checking out visit:', error);
    res.status(500).json({ success: false, message: 'Failed to check out guest visit.' });
  }
});

// ==========================================
// 5. BILLING & FINANCIAL MUTATIONS
// ==========================================

/**
 * GET /api/management/guest-billing/bills
 * List bills with search, paymentStatus, and date filters
 */
router.get('/bills', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';
    const guestVisitId = typeof req.query.guestVisitId === 'string' ? req.query.guestVisitId.trim() : undefined;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.paymentStatus = status;
    }

    if (guestVisitId) {
      where.guestVisitId = guestVisitId;
    }

    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { guestVisit: { guest: { name: { contains: search, mode: 'insensitive' } } } },
        { guestVisit: { guest: { phone: { contains: search, mode: 'insensitive' } } } },
        { guestVisit: { hostStudent: { name: { contains: search, mode: 'insensitive' } } } },
        { guestVisit: { hostStudent: { jntuNo: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, bills] = await Promise.all([
      prisma.guestBill.count({ where }),
      prisma.guestBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
          guestVisit: {
            include: {
              guest: true,
              hostStudent: {
                select: {
                  id: true,
                  name: true,
                  jntuNo: true,
                  blockName: true,
                  roomNumber: true,
                },
              },
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      bills,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching guest bills:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve bills.' });
  }
});

/**
 * GET /api/management/guest-billing/bills/:id
 * Retrieve single bill with items, payments, visit, and guest details
 */
router.get('/bills/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bill = await prisma.guestBill.findUnique({
      where: { id },
      include: {
        items: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        guestVisit: {
          include: {
            guest: true,
            hostStudent: {
              select: {
                id: true,
                name: true,
                jntuNo: true,
                email: true,
                blockName: true,
                roomNumber: true,
              },
            },
          },
        },
      },
    });

    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill record not found.' });
      return;
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('Error fetching bill detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve bill detail.' });
  }
});

/**
 * POST /api/management/guest-billing/bills
 * Transactionally create a bill with items.
 * Strictly calculates totals server-side and enforces valid amounts.
 */
router.post('/bills', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { guestVisitId, billNumber, items } = req.body;

    if (!guestVisitId || typeof guestVisitId !== 'string') {
      res.status(400).json({ success: false, message: 'Valid guest visit ID is required.' });
      return;
    }

    // Verify GuestVisit exists
    const visit = await prisma.guestVisit.findUnique({
      where: { id: guestVisitId },
      include: { guest: true, hostStudent: true },
    });

    if (!visit) {
      res.status(404).json({ success: false, message: 'Guest visit record not found.' });
      return;
    }

    // Billing items validation
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one billing item is required.' });
      return;
    }

    const validatedItems: { description: string; quantity: number; unitAmount: number; totalAmount: number }[] = [];
    let calculatedBillTotal = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const desc = typeof item.description === 'string' ? item.description.trim() : '';
      if (!desc) {
        res.status(400).json({ success: false, message: `Description is required for billing item #${i + 1}.` });
        return;
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({ success: false, message: `Quantity must be an integer greater than 0 for item '${desc}'.` });
        return;
      }

      const unit = parseFloat(item.unitAmount);
      if (isNaN(unit) || unit < 0) {
        res.status(400).json({ success: false, message: `Unit amount must be greater than or equal to 0 for item '${desc}'.` });
        return;
      }

      const itemTotal = Math.round(qty * unit * 100) / 100;
      calculatedBillTotal += itemTotal;

      validatedItems.push({
        description: desc,
        quantity: qty,
        unitAmount: Math.round(unit * 100) / 100,
        totalAmount: itemTotal,
      });
    }

    calculatedBillTotal = Math.round(calculatedBillTotal * 100) / 100;

    // Resolve unique billNumber
    let resolvedBillNumber = typeof billNumber === 'string' && billNumber.trim() ? billNumber.trim().toUpperCase() : '';
    if (resolvedBillNumber) {
      const existingBill = await prisma.guestBill.findUnique({ where: { billNumber: resolvedBillNumber } });
      if (existingBill) {
        res.status(400).json({ success: false, message: `Bill number '${resolvedBillNumber}' already exists. Bill numbers must be unique.` });
        return;
      }
    } else {
      resolvedBillNumber = await generateUniqueBillNumber();
    }

    // Transactional creation
    const [newBill] = await prisma.$transaction(async (tx) => {
      const bill = await tx.guestBill.create({
        data: {
          guestVisitId,
          billNumber: resolvedBillNumber,
          totalAmount: calculatedBillTotal,
          paidAmount: 0,
          balanceAmount: calculatedBillTotal,
          paymentStatus: 'UNPAID',
          items: {
            create: validatedItems.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitAmount: it.unitAmount,
              totalAmount: it.totalAmount,
            })),
          },
        },
        include: {
          items: true,
          guestVisit: {
            include: { guest: true, hostStudent: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: visit.hostStudentId,
          actionType: 'GUEST_BILLING',
          action: 'CREATE',
          actorRole: req.managementUser!.role,
          entity: 'GuestBill',
          entityId: bill.id,
          newState: 'UNPAID',
          description: `Guest Bill ${resolvedBillNumber} created for amount Rs. ${calculatedBillTotal.toFixed(2)} (${validatedItems.length} item(s)) by ${req.managementUser!.name}.`,
        },
      });

      return [bill];
    });

    // Real-time SSE dispatch after commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILL_CREATED',
      timestamp: new Date().toISOString(),
      details: {
        billId: newBill.id,
        billNumber: newBill.billNumber,
        totalAmount: newBill.totalAmount,
        guestName: visit.guest.name,
      },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Guest bill created successfully.',
      bill: newBill,
    });
  } catch (error) {
    console.error('Error creating guest bill:', error);
    res.status(500).json({ success: false, message: 'Failed to create guest bill.' });
  }
});

/**
 * POST /api/management/guest-billing/bills/:id/payment
 * Transactionally record a financial payment against an authoritative bill.
 * Validates against overpayment and preserves payment transaction history.
 */
router.post('/bills/:id/payment', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    const bill = await prisma.guestBill.findUnique({
      where: { id },
      include: {
        guestVisit: {
          include: { guest: true, hostStudent: true },
        },
      },
    });

    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill record not found.' });
      return;
    }

    if (bill.paymentStatus === 'VOID') {
      res.status(400).json({ success: false, message: 'Cannot record payment on a voided bill.' });
      return;
    }

    if (bill.paymentStatus === 'PAID' || bill.balanceAmount <= 0.001) {
      res.status(400).json({ success: false, message: 'Bill is already fully paid.' });
      return;
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
      return;
    }

    // Overpayment prevention rule
    const currentBalance = Math.round(bill.balanceAmount * 100) / 100;
    const roundedPay = Math.round(payAmount * 100) / 100;

    if (roundedPay > currentBalance + 0.001) {
      res.status(400).json({
        success: false,
        message: `Payment amount Rs. ${roundedPay.toFixed(2)} exceeds outstanding balance of Rs. ${currentBalance.toFixed(2)}.`,
      });
      return;
    }

    const method = typeof paymentMethod === 'string' && paymentMethod.trim()
      ? paymentMethod.trim().toUpperCase()
      : 'CASH';

    const ref = typeof paymentReference === 'string' && paymentReference.trim()
      ? paymentReference.trim()
      : null;

    // Execute safe financial transaction
    const [updatedBill, paymentRecord] = await prisma.$transaction(async (tx) => {
      // 1. Create immutable historical payment record
      const payment = await tx.guestPayment.create({
        data: {
          guestBillId: bill.id,
          amount: roundedPay,
          paymentMethod: method,
          paymentReference: ref,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          recordedBy: req.managementUser!.name,
          recordedById: req.managementUser!.id,
        },
      });

      // 2. Authoritatively recalculate bill balances
      const newPaidTotal = Math.round((bill.paidAmount + roundedPay) * 100) / 100;
      const newBalance = Math.max(0, Math.round((bill.totalAmount - newPaidTotal) * 100) / 100);
      const isFullyPaid = newBalance <= 0.001;
      const newStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

      const updated = await tx.guestBill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidTotal,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
          paymentMethod: method,
          paymentReference: ref || bill.paymentReference,
          paidAt: isFullyPaid ? new Date() : bill.paidAt,
        },
        include: {
          items: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
          guestVisit: {
            include: { guest: true, hostStudent: true },
          },
        },
      });

      // 3. Financial audit record
      await tx.activityLog.create({
        data: {
          studentId: bill.guestVisit.hostStudentId,
          actionType: 'GUEST_BILLING',
          action: 'PAYMENT_RECORDED',
          actorRole: req.managementUser!.role,
          entity: 'GuestBill',
          entityId: bill.id,
          previousState: bill.paymentStatus,
          newState: newStatus,
          description: `Payment of Rs. ${roundedPay.toFixed(2)} received for Bill ${bill.billNumber} via ${method}. Status: ${newStatus}. Balance: Rs. ${newBalance.toFixed(2)}.`,
        },
      });

      return [updated, payment];
    });

    // Real-time SSE dispatch after commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_PAYMENT_RECORDED',
      timestamp: new Date().toISOString(),
      details: {
        billId: updatedBill.id,
        billNumber: updatedBill.billNumber,
        paidAmount: roundedPay,
        paymentStatus: updatedBill.paymentStatus,
        balanceAmount: updatedBill.balanceAmount,
      },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Payment of Rs. ${roundedPay.toFixed(2)} recorded successfully.`,
      bill: updatedBill,
      payment: paymentRecord,
    });
  } catch (error) {
    console.error('Error recording bill payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment transaction.' });
  }
});

/**
 * POST /api/management/guest-billing/bills/:id/void
 * Void a guest bill with mandatory reason.
 * Preserves financial and payment audit trail.
 */
router.post('/bills/:id/void', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Enforce management RBAC (only WARDEN, CHIEF_WARDEN, ADMIN, HOSTEL_ADMIN)
    if (!MANAGEMENT_ROLES.includes(req.managementUser?.role || '')) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized. Account lacks permission to void financial records.',
      });
      return;
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 3) {
      res.status(400).json({
        success: false,
        message: 'A valid explanation/reason (minimum 3 characters) is required to void a bill.',
      });
      return;
    }

    const bill = await prisma.guestBill.findUnique({
      where: { id },
      include: {
        guestVisit: {
          include: { guest: true, hostStudent: true },
        },
      },
    });

    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill record not found.' });
      return;
    }

    if (bill.paymentStatus === 'VOID') {
      res.status(400).json({ success: false, message: 'This bill has already been voided.' });
      return;
    }

    const priorStatus = bill.paymentStatus;
    const voidDate = new Date();

    const [voidedBill] = await prisma.$transaction(async (tx) => {
      const updated = await tx.guestBill.update({
        where: { id },
        data: {
          paymentStatus: 'VOID',
          voidReason: trimmedReason,
          voidedAt: voidDate,
          voidedBy: req.managementUser!.name,
        },
        include: {
          items: true,
          payments: true,
          guestVisit: {
            include: { guest: true, hostStudent: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: bill.guestVisit.hostStudentId,
          actionType: 'GUEST_BILLING',
          action: 'VOID',
          actorRole: req.managementUser!.role,
          entity: 'GuestBill',
          entityId: bill.id,
          previousState: priorStatus,
          newState: 'VOID',
          description: `Bill ${bill.billNumber} (Rs. ${bill.totalAmount.toFixed(2)}) VOIDED by ${req.managementUser!.name}. Reason: ${trimmedReason}. (Prior status: ${priorStatus}).`,
        },
      });

      return [updated];
    });

    // Real-time SSE dispatch after commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILL_VOIDED',
      timestamp: new Date().toISOString(),
      details: {
        billId: voidedBill.id,
        billNumber: voidedBill.billNumber,
        voidReason: trimmedReason,
        voidedBy: req.managementUser!.name,
      },
    });
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'GUEST_BILLING_STATS_UPDATED',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Bill ${voidedBill.billNumber} has been voided.`,
      bill: voidedBill,
    });
  } catch (error) {
    console.error('Error voiding bill:', error);
    res.status(500).json({ success: false, message: 'Failed to void bill.' });
  }
});

export default router;
