import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';
import { complaintEventsService } from '../services/events.service';

const router = Router();

const VALID_MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const;
type MealType = (typeof VALID_MEALS)[number];

interface MealConfig {
  type: MealType;
  name: string;
  timing: string;
  description: string;
}

const MEAL_CONFIGS: MealConfig[] = [
  {
    type: 'BREAKFAST',
    name: 'Breakfast',
    timing: '07:30 AM - 09:30 AM',
    description: 'Hot breakfast buffet with choice of beverages',
  },
  {
    type: 'LUNCH',
    name: 'Lunch',
    timing: '12:30 PM - 02:30 PM',
    description: 'Complete nutritional multi-course lunch meal',
  },
  {
    type: 'SNACKS',
    name: 'Evening Snacks',
    timing: '04:30 PM - 06:00 PM',
    description: 'Evening tea, coffee, and fresh evening snacks',
  },
  {
    type: 'DINNER',
    name: 'Dinner',
    timing: '07:30 PM - 09:30 PM',
    description: 'Residential dinner with seasonal specials',
  },
];

/**
 * Generate user-friendly unique token identifier
 */
function generateTokenNumber(dateStr: string, mealType: string): string {
  const dateTag = dateStr.replace(/-/g, '');
  const mealTag = mealType.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MT-${dateTag}-${mealTag}-${randomSuffix}`;
}

/**
 * GET /api/student/mess-tokens
 * Returns student's token booking status, daily meal slots, active passes, and token history
 */
router.get('/mess-tokens', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // 2. Fetch today's tokens for this student
    const todayTokens = await prisma.messToken.findMany({
      where: {
        studentId,
        date: todayStr,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Map meal slots for today
    const mealSlots = MEAL_CONFIGS.map((config) => {
      const bookedToken = todayTokens.find((t) => t.mealType === config.type);

      if (bookedToken) {
        return {
          mealType: config.type,
          name: config.name,
          timing: config.timing,
          description: config.description,
          status: bookedToken.status === 'CONSUMED' ? 'USED' : 'BOOKED',
          token: {
            id: bookedToken.id,
            tokenNumber: bookedToken.tokenNumber,
            date: bookedToken.date,
            mealType: bookedToken.mealType,
            status: bookedToken.status,
            createdAt: bookedToken.createdAt,
            timing: config.timing,
          },
        };
      }

      return {
        mealType: config.type,
        name: config.name,
        timing: config.timing,
        description: config.description,
        status: 'AVAILABLE',
        token: null,
      };
    });

    const bookedCount = todayTokens.filter((t) => t.status !== 'CANCELLED').length;
    const totalMeals = MEAL_CONFIGS.length;
    const remainingCount = Math.max(0, totalMeals - bookedCount);

    let summaryStatus = 'No Bookings';
    if (bookedCount === totalMeals) {
      summaryStatus = 'All Meals Booked';
    } else if (bookedCount > 0) {
      summaryStatus = `${bookedCount} Booked Today`;
    }

    // 4. Fetch past/recent token history (ordered by date desc, createdAt desc)
    const rawHistory = await prisma.messToken.findMany({
      where: { studentId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    const history = rawHistory.map((item) => {
      const mealConf = MEAL_CONFIGS.find((c) => c.type === item.mealType);
      return {
        id: item.id,
        tokenNumber: item.tokenNumber,
        date: item.date,
        mealType: item.mealType,
        mealName: mealConf?.name || item.mealType,
        timing: mealConf?.timing || '',
        status: item.status,
        createdAt: item.createdAt,
      };
    });

    // 5. Active token passes for today
    const activeTokensToday = todayTokens
      .filter((t) => t.status === 'BOOKED')
      .map((t) => {
        const mealConf = MEAL_CONFIGS.find((c) => c.type === t.mealType);
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          date: t.date,
          mealType: t.mealType,
          mealName: mealConf?.name || t.mealType,
          timing: mealConf?.timing || '',
          status: t.status,
          createdAt: t.createdAt,
          studentName: student.name,
          jntuNo: student.jntuNo,
          blockName: student.blockName || 'Residential Mess Hall',
          roomNumber: student.roomNumber || 'Hostel Campus',
        };
      });

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        allocationStatus: student.allocationStatus,
      },
      today: {
        date: todayStr,
        formattedDate,
        summary: {
          totalMeals,
          bookedCount,
          remainingCount,
          summaryStatus,
        },
        mealSlots,
        activeTokensToday,
      },
      history,
    });
  } catch (error) {
    console.error('Error fetching mess tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load mess token information. Please try again.',
    });
  }
});

/**
 * POST /api/student/mess-tokens/book
 * Atomically books a meal token for the authenticated student
 */
router.post('/mess-tokens/book', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Verify student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable.',
      });
      return;
    }

    // 2. Validate input
    const { mealType, date } = req.body;

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid mealType is required.',
      });
      return;
    }

    const normalizedMeal = mealType.toUpperCase() as MealType;
    if (!VALID_MEALS.includes(normalizedMeal)) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr;

    // 3. Duplicate check before creation
    const existing = await prisma.messToken.findUnique({
      where: {
        studentId_date_mealType: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
        },
      },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `You have already booked a mess token for ${normalizedMeal.toLowerCase()} on this date.`,
      });
      return;
    }

    // 4. Generate user-facing token reference
    const tokenNumber = generateTokenNumber(targetDate, normalizedMeal);
    const mealConfig = MEAL_CONFIGS.find((c) => c.type === normalizedMeal);

    // 5. Transactional creation: create token and record activity log
    const [newToken] = await prisma.$transaction([
      prisma.messToken.create({
        data: {
          studentId,
          tokenNumber,
          date: targetDate,
          mealType: normalizedMeal,
          status: 'BOOKED',
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'MESS',
          description: `Booked ${mealConfig?.name || normalizedMeal} token (${tokenNumber}) for ${targetDate}`,
        },
      }),
    ]);

    // Emit real-time event
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: 'MESS_TOKEN_BOOKED',
      tokenId: newToken.id,
      studentId,
      date: newToken.date,
      mealType: newToken.mealType,
      status: newToken.status,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: `${mealConfig?.name || normalizedMeal} mess token booked successfully.`,
      token: {
        id: newToken.id,
        tokenNumber: newToken.tokenNumber,
        mealType: newToken.mealType,
        mealName: mealConfig?.name || newToken.mealType,
        date: newToken.date,
        status: newToken.status,
        timing: mealConfig?.timing || '',
        createdAt: newToken.createdAt,
      },
    });
  } catch (error: any) {
    // Handle Prisma unique constraint race-condition violation (P2002)
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'You have already booked a mess token for this meal.',
      });
      return;
    }

    console.error('Error booking mess token:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to book mess token. Please try again.',
    });
  }
});

export default router;
