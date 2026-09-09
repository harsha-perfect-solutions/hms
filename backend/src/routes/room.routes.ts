import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';

const router = Router();

/**
 * GET /api/student/my-room
 * Returns current authenticated student's accommodation details, room overview, and authorized roommates
 */
router.get('/my-room', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Fetch current student record
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable. Please contact the administrator.',
      });
      return;
    }

    // 2. Check if student has an active allocation
    if (student.allocationStatus !== 'ALLOCATED' || !student.blockName || !student.roomNumber) {
      res.status(200).json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          jntuNo: student.jntuNo,
          email: student.email,
        },
        allocation: {
          status: student.allocationStatus || 'NOT_ALLOCATED',
          allocatedAt: student.allocatedAt,
        },
        room: null,
        roommates: [],
      });
      return;
    }

    // 3. Find roommates allocated to the exact same block & room
    const allocatedOccupants = await prisma.student.findMany({
      where: {
        blockName: student.blockName,
        roomNumber: student.roomNumber,
        allocationStatus: 'ALLOCATED',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        jntuNo: true,
        bedNumber: true,
        allocationStatus: true,
      },
      orderBy: { bedNumber: 'asc' },
    });

    const capacity = student.roomCapacity || 2;
    const occupancy = allocatedOccupants.length;
    const occupancyStatus = occupancy >= capacity ? 'Occupied' : 'Partially Occupied';

    // 4. Map roommates with isCurrentStudent flag, never exposing private credentials
    const roommates = allocatedOccupants.map((occupant) => ({
      id: occupant.id,
      name: occupant.name,
      jntuNo: occupant.jntuNo,
      bedNumber: occupant.bedNumber,
      allocationStatus: occupant.allocationStatus,
      isCurrentStudent: occupant.id === student.id,
    }));

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        email: student.email,
      },
      allocation: {
        status: student.allocationStatus,
        block: student.blockName,
        roomNumber: student.roomNumber,
        floor: student.floorName,
        bedNumber: student.bedNumber,
        roomType: student.roomType,
        allocatedAt: student.allocatedAt,
      },
      room: {
        block: student.blockName,
        roomNumber: student.roomNumber,
        floor: student.floorName,
        roomType: student.roomType,
        capacity,
        occupancy,
        occupancyStatus,
      },
      roommates,
    });
  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load room information. Please try again.',
    });
  }
});

export default router;
