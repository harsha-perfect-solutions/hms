import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';

const router = Router();

// All block management routes require authoritative management access
router.use(authenticateManagement);

/**
 * GET /api/management/blocks
 * Retrieves all blocks with computed resident counts and optional filtering
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    const whereClause: any = {};

    if (typeof status === 'string' && status.trim()) {
      const normalizedStatus = status.trim().toUpperCase();
      if (['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        whereClause.status = normalizedStatus;
      }
    }

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const blocks = await prisma.block.findMany({
      where: whereClause,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    // Compute active resident count per block
    const blocksWithResidents = await Promise.all(
      blocks.map(async (block) => {
        const activeResidents = await prisma.student.count({
          where: {
            OR: [
              { blockName: block.name },
              { blockName: block.code },
            ],
            allocationStatus: 'ALLOCATED',
            isActive: true,
          },
        });

        const totalRooms = await prisma.student
          .groupBy({
            by: ['roomNumber'],
            where: {
              OR: [
                { blockName: block.name },
                { blockName: block.code },
              ],
              roomNumber: { not: null },
            },
          })
          .then((rooms) => rooms.length);

        return {
          ...block,
          activeResidents,
          totalRooms,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: blocksWithResidents.length,
      blocks: blocksWithResidents,
    });
  } catch (error) {
    console.error('Error retrieving blocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hostel blocks. Please try again.',
    });
  }
});

/**
 * GET /api/management/blocks/:id
 * Retrieves a single block by ID with allocation statistics
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const block = await prisma.block.findUnique({
      where: { id },
    });

    if (!block) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    const activeResidents = await prisma.student.count({
      where: {
        OR: [
          { blockName: block.name },
          { blockName: block.code },
        ],
        allocationStatus: 'ALLOCATED',
        isActive: true,
      },
    });

    const totalAllocations = await prisma.student.count({
      where: {
        OR: [
          { blockName: block.name },
          { blockName: block.code },
        ],
      },
    });

    res.status(200).json({
      success: true,
      block: {
        ...block,
        activeResidents,
        totalAllocations,
      },
    });
  } catch (error) {
    console.error('Error retrieving block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve block details.',
    });
  }
});

/**
 * POST /api/management/blocks
 * Creates a new authoritative hostel block with validation and audit logging
 */
router.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, status = 'ACTIVE' } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Block name must be at least 2 characters.',
      });
      return;
    }

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Block code must be at least 2 characters.',
      });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();
    const normalizedStatus = (status || 'ACTIVE').toUpperCase();

    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: "Status must be either 'ACTIVE' or 'INACTIVE'.",
      });
      return;
    }

    // 2. Uniqueness check
    const existingBlock = await prisma.block.findUnique({
      where: { code: normalizedCode },
    });

    if (existingBlock) {
      res.status(409).json({
        success: false,
        message: `A block with code '${normalizedCode}' already exists (${existingBlock.name}).`,
      });
      return;
    }

    // 3. Create block and audit log in transaction
    const [newBlock] = await prisma.$transaction([
      prisma.block.create({
        data: {
          name: normalizedName,
          code: normalizedCode,
          description: typeof description === 'string' ? description.trim() : null,
          status: normalizedStatus,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'BLOCK_MANAGEMENT',
          description: `Created block '${normalizedName}' (${normalizedCode}) with status ${normalizedStatus}`,
        },
      }),
    ]);

    // 4. Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'BLOCK_CREATED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: newBlock.id,
        name: newBlock.name,
        code: newBlock.code,
        status: newBlock.status,
      },
    });

    res.status(201).json({
      success: true,
      message: `Block '${newBlock.name}' created successfully.`,
      block: {
        ...newBlock,
        activeResidents: 0,
        totalRooms: 0,
      },
    });
  } catch (error) {
    console.error('Error creating block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create block. Please try again.',
    });
  }
});

/**
 * PUT /api/management/blocks/:id
 * Updates an existing block with validation, uniqueness checks, and audit logging
 */
router.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description, status } = req.body;

    const existingBlock = await prisma.block.findUnique({
      where: { id },
    });

    if (!existingBlock) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Block name must be at least 2 characters.',
        });
        return;
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Block code must be at least 2 characters.',
        });
        return;
      }
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode !== existingBlock.code) {
        const codeConflict = await prisma.block.findUnique({
          where: { code: normalizedCode },
        });
        if (codeConflict) {
          res.status(409).json({
            success: false,
            message: `A block with code '${normalizedCode}' already exists (${codeConflict.name}).`,
          });
          return;
        }
        updateData.code = normalizedCode;
      }
    }

    if (status !== undefined) {
      const normalizedStatus = status.toString().trim().toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        res.status(400).json({
          success: false,
          message: "Status must be either 'ACTIVE' or 'INACTIVE'.",
        });
        return;
      }
      updateData.status = normalizedStatus;
    }

    if (description !== undefined) {
      updateData.description = typeof description === 'string' ? description.trim() : null;
    }

    const isStatusChanged = updateData.status && updateData.status !== existingBlock.status;
    const auditDesc = isStatusChanged
      ? `Changed status of block '${updateData.name || existingBlock.name}' from ${existingBlock.status} to ${updateData.status}`
      : `Updated block '${updateData.name || existingBlock.name}' (${updateData.code || existingBlock.code})`;

    const [updatedBlock] = await prisma.$transaction([
      prisma.block.update({
        where: { id },
        data: updateData,
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'BLOCK_MANAGEMENT',
          description: auditDesc,
        },
      }),
    ]);

    // Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: isStatusChanged ? 'BLOCK_STATUS_CHANGED' : 'BLOCK_UPDATED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: updatedBlock.id,
        code: updatedBlock.code,
        status: updatedBlock.status,
      },
    });

    const activeResidents = await prisma.student.count({
      where: {
        OR: [
          { blockName: updatedBlock.name },
          { blockName: updatedBlock.code },
        ],
        allocationStatus: 'ALLOCATED',
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `Block '${updatedBlock.name}' updated successfully.`,
      block: {
        ...updatedBlock,
        activeResidents,
      },
    });
  } catch (error) {
    console.error('Error updating block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update block.',
    });
  }
});

/**
 * DELETE /api/management/blocks/:id
 * Safe deletion: enforces dependency checks against student/room allocations
 */
router.delete('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingBlock = await prisma.block.findUnique({
      where: { id },
    });

    if (!existingBlock) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    // Dependency check: Ensure no student records depend on this block
    const dependentCount = await prisma.student.count({
      where: {
        OR: [
          { blockName: existingBlock.name },
          { blockName: existingBlock.code },
        ],
      },
    });

    if (dependentCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete block '${existingBlock.name}' (${existingBlock.code}) because ${dependentCount} student record(s) or room allocation(s) are assigned to it. Reassign residents before deleting.`,
        dependentCount,
      });
      return;
    }

    // Safe deletion in transaction with audit log
    await prisma.$transaction([
      prisma.block.delete({
        where: { id },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'BLOCK_MANAGEMENT',
          description: `Deleted block '${existingBlock.name}' (${existingBlock.code})`,
        },
      }),
    ]);

    // Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'BLOCK_DELETED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: existingBlock.id,
        code: existingBlock.code,
        name: existingBlock.name,
      },
    });

    res.status(200).json({
      success: true,
      message: `Block '${existingBlock.name}' (${existingBlock.code}) deleted successfully.`,
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete block.',
    });
  }
});

export default router;
