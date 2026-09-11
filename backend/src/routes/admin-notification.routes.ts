import { Router, Response } from 'express';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { notificationService } from '../services/notification.service';

const router = Router();

// All administrative notification endpoints require management authentication
router.use(authenticateManagement);

// Authorized Management Roles
const AUTHORIZED_ROLES = ['ADMIN', 'HOSTEL_ADMIN', 'CHIEF_WARDEN', 'WARDEN'];

/**
 * GET /api/management/notifications/stats
 * Authoritative KPI metrics from PostgreSQL
 */
router.get(
  '/stats',
  requireRoles(...AUTHORIZED_ROLES),
  async (_req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const stats = await notificationService.getAdminNotificationStats();
      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification statistics.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/notifications/recipients/resolve
 * Preview recipient count & matching records for targeted broadcast
 */
router.get(
  '/recipients/resolve',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { scope, studentId, studentIds, blockName, roomNumber, targetRole } = req.query as Record<
        string,
        string
      >;

      const parsedIds = studentIds ? studentIds.split(',').map((s) => s.trim()) : undefined;

      const recipients = await notificationService.resolveRecipients(scope || 'ALL_STUDENTS', {
        studentId,
        studentIds: parsedIds,
        blockName,
        roomNumber,
        targetRole,
      });

      res.status(200).json({
        success: true,
        count: recipients.length,
        recipients: recipients.slice(0, 50), // Preview up to 50
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to resolve recipients.',
      });
    }
  }
);

/**
 * GET /api/management/notifications
 * Paginated, filtered list of all notifications across HMS with live KPIs
 */
router.get(
  '/',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        page,
        pageSize,
        limit,
        search,
        category,
        priority,
        status,
        source,
        studentId,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      } = req.query as Record<string, string>;

      const result = await notificationService.getAdminNotifications({
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : limit ? parseInt(limit, 10) : undefined,
        search,
        category,
        priority,
        status,
        source,
        studentId,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error listing admin notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification history.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/notifications/:id
 * Single notification detailed view with recipient and audit trail metadata
 */
router.get(
  '/:id',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Valid notification ID is required.' });
        return;
      }

      const notification = await notificationService.getAdminNotificationDetail(id.trim());

      res.status(200).json({
        success: true,
        notification,
      });
    } catch (error: any) {
      if (error.message === 'NOTIFICATION_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Notification not found.' });
        return;
      }

      console.error('Error fetching notification detail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification details.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/notifications
 * Send targeted administrative notifications with server-side resolution, audit log, and SSE
 */
router.post(
  '/',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        title,
        message,
        category,
        priority,
        type,
        recipientScope,
        studentId,
        studentIds,
        blockName,
        roomNumber,
        targetRole,
        link,
        expiresAt,
        metadata,
      } = req.body;

      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const result = await notificationService.createAdminNotification(
        {
          title,
          message,
          category,
          priority,
          type,
          recipientScope,
          studentId,
          studentIds,
          blockName,
          roomNumber,
          targetRole,
          link,
          expiresAt,
          metadata,
        },
        actor
      );

      res.status(201).json({
        success: true,
        message: result.message,
        recipientCount: result.recipientCount,
      });
    } catch (error: any) {
      console.error('Error creating admin notification:', error);
      if (
        error.message?.includes('required') ||
        error.message?.includes('Invalid') ||
        error.message?.includes('exceed') ||
        error.message?.includes('recipient') ||
        error.message?.includes('deep link') ||
        error.message?.includes('scope')
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to send notification.',
        error: error.message,
      });
    }
  }
);

export default router;
