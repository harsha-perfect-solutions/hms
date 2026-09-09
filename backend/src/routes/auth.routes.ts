import { Router, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { loginRateLimiter } from '../middleware/rate-limiter';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/login
 * Rate-limited student login endpoint
 */
router.post('/login', loginRateLimiter, async (req, res): Promise<void> => {
  try {
    const { jntuNo, password } = req.body;
    const result = await AuthService.login(jntuNo, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error('Unhandled login error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to sign in right now. Please try again.',
    });
  }
});

/**
 * POST /api/auth/logout
 * Session invalidation endpoint
 */
router.post('/logout', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await AuthService.logout(token);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieve authenticated session and student details
 */
router.get('/me', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Unauthenticated',
      });
      return;
    }

    const studentProfile = await AuthService.getStudentProfile(req.student.id);

    res.status(200).json({
      success: true,
      user: studentProfile,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error('Auth me error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch session profile.',
    });
  }
});

export default router;
