import { Router, Response } from 'express';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { deviceService } from '../services/device.service';

const router = Router();

// All Device Management endpoints require management authentication
router.use(authenticateManagement);

// Authorized Management Roles
const AUTHORIZED_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
];

/**
 * GET /api/management/devices
 * Paginated, filtered list of registered hardware devices with live KPI metrics
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
        type,
        status,
        enabled,
        location,
        sortBy,
        sortOrder,
      } = req.query as Record<string, string>;

      const result = await deviceService.getDevices({
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : limit ? parseInt(limit, 10) : undefined,
        search,
        type,
        status,
        enabled,
        location,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error listing devices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve registered devices.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/devices/:id
 * Single device detailed view with correlated telemetry and event aggregates
 */
router.get(
  '/:id',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Valid device ID is required.' });
        return;
      }

      const device = await deviceService.getDeviceDetail(id.trim());

      res.status(200).json({
        success: true,
        device,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }

      console.error('Error fetching device detail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve device details.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/devices
 * Register a new physical hardware device with secure cryptographic key generation
 */
router.post(
  '/',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        deviceIdentifier,
        deviceType,
        location,
        description,
        isEnabled,
        ipAddress,
        macAddress,
        firmwareVersion,
        maintenanceNotes,
        configMetadata,
      } = req.body;

      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const result = await deviceService.createDevice(
        {
          name,
          deviceIdentifier,
          deviceType,
          location,
          description,
          isEnabled,
          ipAddress,
          macAddress,
          firmwareVersion,
          maintenanceNotes,
          configMetadata,
        },
        actor
      );

      res.status(201).json({
        success: true,
        message: 'Device registered successfully.',
        device: result.device,
        apiKey: result.apiKey,
        warning: result.warning,
      });
    } catch (error: any) {
      console.error('Error creating device:', error);
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('required') ||
        error.message?.includes('Invalid')
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to register device.',
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/management/devices/:id
 * Update safe administrative device attributes
 */
router.put(
  '/:id',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Valid device ID is required.' });
        return;
      }

      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const updated = await deviceService.updateDevice(id.trim(), req.body, actor);

      res.status(200).json({
        success: true,
        message: 'Device updated successfully.',
        device: updated,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }
      if (error.message?.includes('Invalid')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      console.error('Error updating device:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update device.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/devices/:id/enable
 * Enable a registered device
 */
router.post(
  '/:id/enable',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const device = await deviceService.setDeviceEnabled(id, true, actor);

      res.status(200).json({
        success: true,
        message: 'Device enabled successfully.',
        device,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }

      console.error('Error enabling device:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable device.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/devices/:id/disable
 * Disable a registered device
 */
router.post(
  '/:id/disable',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const device = await deviceService.setDeviceEnabled(id, false, actor);

      res.status(200).json({
        success: true,
        message: 'Device disabled successfully.',
        device,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }

      console.error('Error disabling device:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable device.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/devices/:id/rotate-credential
 * Securely rotate a device's cryptographic key
 */
router.post(
  '/:id/rotate-credential',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Admin',
        role: req.managementUser?.role || 'ADMIN',
      };

      const result = await deviceService.rotateDeviceCredential(id, actor);

      res.status(200).json({
        success: true,
        message: 'Device credential rotated successfully.',
        device: result.device,
        apiKey: result.apiKey,
        warning: result.warning,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }

      console.error('Error rotating device credential:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to rotate device credential.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/devices/:id/activity
 * Read-only activity audit trail for a device
 */
router.get(
  '/:id/activity',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { page, pageSize } = req.query as Record<string, string>;

      const activity = await deviceService.getDeviceActivity(
        id,
        page ? parseInt(page, 10) : 1,
        pageSize ? parseInt(pageSize, 10) : 25
      );

      res.status(200).json({
        success: true,
        ...activity,
      });
    } catch (error: any) {
      if (error.message === 'DEVICE_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'Device not found.' });
        return;
      }

      console.error('Error fetching device activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve device activity.',
        error: error.message,
      });
    }
  }
);

export default router;
