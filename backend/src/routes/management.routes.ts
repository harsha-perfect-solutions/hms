import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.service';
import { config } from '../config';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
} from '../middleware/management.middleware';
import { managementService } from '../services/management.service';
import { complaintEventsService } from '../services/events.service';
import { loginRateLimiter } from '../middleware/rate-limiter';
import blockRoutes from './block.routes';
import { roomManagementRouter, roomAllocationRouter } from './room-management.routes';
import messManagementRouter from './mess-management.routes';

const router = Router();

// Sub-routers
router.use('/blocks', blockRoutes);
router.use('/rooms', roomManagementRouter);
router.use('/room-allocations', roomAllocationRouter);
router.use('/mess', messManagementRouter);


/**
 * POST /api/management/auth/login
 * Authoritative Warden and Administrative personnel authentication
 * Enforces server-side RBAC: students are rejected with 403.
 */
router.post('/auth/login', loginRateLimiter, async (req, res): Promise<void> => {
  try {
    const { username, jntuNo, password } = req.body;
    const identifier = (username || jntuNo || '').trim().toUpperCase();

    if (!identifier) {
      res.status(400).json({
        success: false,
        message: 'Please enter your management staff identifier.',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
      return;
    }

    // Lookup user by JNTU / Staff ID or email
    const user = await prisma.student.findFirst({
      where: {
        OR: [
          { jntuNo: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
    });

    if (!user) {
      // Dummy compare to mitigate timing attacks
      await bcrypt.compare(password, '$2a$10$wN35rB7z.Mv1B78.9K2e6.03u9GfLgKqQYwXqWwOqX7g8mC4uGk4u');
      res.status(401).json({
        success: false,
        message: 'Invalid management staff credentials.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently inactive. Contact the chief administrator.',
      });
      return;
    }

    // Server-Side RBAC Enforcement: Students are denied access to management login
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Student accounts cannot access the management portal.',
      });
      return;
    }

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid management staff credentials.',
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        jntuNo: user.jntuNo,
        role: user.role,
        portal: 'MANAGEMENT',
      },
      config.jwtSecret,
      {
        expiresIn: '7d',
        jwtid: Math.random().toString(36).substring(2) + '-' + Date.now().toString(36),
      }
    );

    // Save session in PostgreSQL
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        token,
        studentId: user.id,
        expiresAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Management authentication successful.',
      token,
      user: {
        id: user.id,
        jntuNo: user.jntuNo,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Management login error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to sign in to management portal right now.',
    });
  }
});

/**
 * POST /api/management/auth/logout
 * Terminates active management session
 */
router.post('/auth/logout', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await prisma.session.delete({ where: { token } }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Management session terminated successfully.',
    });
  } catch (error) {
    console.error('Management logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during management logout.',
    });
  }
});

/**
 * GET /api/management/auth/me
 * Retrieves current authenticated management profile
 */
router.get(
  '/auth/me',
  authenticateManagement,
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    res.status(200).json({
      success: true,
      user: req.managementUser,
    });
  }
);

/**
 * GET /api/management/dashboard
 * Aggregated authoritative operational management dashboard
 */
router.get(
  '/dashboard',
  authenticateManagement,
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const data = await managementService.getDashboardData();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('Error retrieving management dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve operational dashboard data.',
      });
    }
  }
);

/**
 * GET /api/management/events-stream
 * Real-time SSE Stream for Management Dashboards
 */
router.get(
  '/events-stream',
  authenticateManagement,
  (req: AuthenticatedManagementRequest, res: Response): void => {
    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    complaintEventsService.registerManagementClient(req.managementUser.id, res);
  }
);

export default router;
