import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../services/prisma.service';

export const MANAGEMENT_ROLES = ['WARDEN', 'CHIEF_WARDEN', 'ADMIN', 'HOSTEL_ADMIN'];

export interface ManagementUser {
  id: string;
  jntuNo: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthenticatedManagementRequest extends Request {
  managementUser?: ManagementUser;
}

/**
 * Server-Side RBAC Authentication Middleware for Management
 * Verifies that the requester is authenticated and holds an authorized management role.
 * Rejects unauthenticated requests with 401.
 * Rejects students and unauthorized roles with 403.
 */
export const authenticateManagement = async (
  req: AuthenticatedManagementRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
      token = req.query.token.trim();
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    // Check if session exists in database and has not expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: { student: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { token } }).catch(() => {});
      }
      res.status(401).json({
        success: false,
        message: 'Session expired or invalidated. Please sign in again.',
      });
      return;
    }

    // Verify cryptographic signature of JWT
    try {
      jwt.verify(token, config.jwtSecret);
    } catch (jwtErr) {
      res.status(401).json({
        success: false,
        message: 'Session verification failed.',
      });
      return;
    }

    const user = session.student;

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently inactive or suspended. Contact administration.',
      });
      return;
    }

    // Server-Side RBAC: Verify user role against authorized management roles
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Account lacks management administrative privileges.',
      });
      return;
    }

    req.managementUser = {
      id: user.id,
      jntuNo: user.jntuNo,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Management authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to authenticate management session right now.',
    });
  }
};
