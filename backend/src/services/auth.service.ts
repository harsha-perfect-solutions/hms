import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service';
import { config } from '../config';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    jntuNo: string;
    name: string;
    email: string;
    role: string;
    blockName?: string | null;
    floorName?: string | null;
    roomNumber?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
  };
}

export class AuthService {
  /**
   * Validate JNTU number format (8-12 alphanumeric characters)
   */
  static isValidJntuFormat(jntuNo: string): boolean {
    const trimmed = jntuNo.trim();
    return /^[A-Za-z0-9]{8,12}$/.test(trimmed);
  }

  /**
   * Authenticate student using JNTU No. and Password
   */
  static async login(rawJntuNo: any, rawPassword: any): Promise<LoginResult> {
    // 1. Validation for empty or missing JNTU No.
    if (rawJntuNo === undefined || rawJntuNo === null || typeof rawJntuNo !== 'string' || rawJntuNo.trim().length === 0) {
      throw { status: 400, message: 'Please enter your JNTU number.' };
    }

    // 2. Validation for empty or missing Password (do NOT trim password)
    if (rawPassword === undefined || rawPassword === null || typeof rawPassword !== 'string' || rawPassword.length === 0) {
      throw { status: 400, message: 'Password is required.' };
    }

    const jntuNo = rawJntuNo.trim().toUpperCase();
    const password = rawPassword;

    if (!this.isValidJntuFormat(jntuNo)) {
      // Return generic credentials error without disclosing format internals
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 3. Lookup student in database
    const student = await prisma.student.findUnique({
      where: { jntuNo },
    });

    if (!student) {
      // Timing attack mitigation: compute dummy bcrypt hash so response time is uniform
      await bcrypt.compare(password, '$2a$10$wN35rB7z.Mv1B78.9K2e6.03u9GfLgKqQYwXqWwOqX7g8mC4uGk4u');
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 4. Check if account is active
    if (!student.isActive) {
      throw {
        status: 403,
        message: 'This account is currently unavailable. Please contact the administrator.',
      };
    }

    // 5. Verify backend-determined role
    if (student.role !== 'STUDENT') {
      throw {
        status: 403,
        message: 'Access denied. Account is not permitted to access student portal.',
      };
    }

    // 6. Verify password hash using bcrypt
    const isPasswordValid = await bcrypt.compare(password, student.passwordHash);
    if (!isPasswordValid) {
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 7. Generate JWT session token
    const token = jwt.sign(
      {
        id: student.id,
        jntuNo: student.jntuNo,
        role: student.role,
      },
      config.jwtSecret,
      {
        expiresIn: '7d',
        jwtid: Math.random().toString(36).substring(2) + '-' + Date.now().toString(36),
      }
    );

    // 8. Store session in database for server-authoritative invalidation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        token,
        studentId: student.id,
        expiresAt,
      },
    });

    return {
      token,
      user: {
        id: student.id,
        jntuNo: student.jntuNo,
        name: student.name,
        email: student.email,
        role: student.role,
        blockName: student.blockName,
        floorName: student.floorName,
        roomNumber: student.roomNumber,
        bedNumber: student.bedNumber,
        roomType: student.roomType,
      },
    };
  }

  /**
   * Invalidate session on logout
   */
  static async logout(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      await prisma.session.deleteMany({
        where: { token },
      });
      return true;
    } catch (error) {
      console.error('Logout revocation error:', error);
      return false;
    }
  }

  /**
   * Retrieve student profile by ID
   */
  static async getStudentProfile(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        jntuNo: true,
        name: true,
        email: true,
        role: true,
        blockName: true,
        floorName: true,
        roomNumber: true,
        bedNumber: true,
        roomType: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!student || !student.isActive) {
      throw { status: 404, message: 'This account is currently unavailable. Please contact the administrator.' };
    }

    return student;
  }
}
