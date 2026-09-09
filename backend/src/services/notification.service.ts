import { prisma } from './prisma.service';
import { complaintEventsService, NotificationDomainEvent } from './events.service';

export const VALID_NOTIFICATION_CATEGORIES = [
  'OUTING',
  'LEAVE',
  'COMPLAINT',
  'MESS',
  'SUSPENSION',
  'ROOM',
  'SYSTEM',
] as const;

export type NotificationCategory = (typeof VALID_NOTIFICATION_CATEGORIES)[number];

export interface CreateNotificationInput {
  studentId: string;
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'SUCCESS';
  category?: NotificationCategory;
  entityId?: string;
  link?: string;
  metadata?: Record<string, any>;
}

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  category?: string;
  unreadOnly?: boolean;
}

export class NotificationService {
  /**
   * Creates a notification record in PostgreSQL and emits a real-time SSE event.
   * Can participate in an external Prisma transaction if provided.
   */
  async createNotification(
    input: CreateNotificationInput,
    txPrisma?: any
  ) {
    const client = txPrisma || prisma;

    const notification = await client.notification.create({
      data: {
        studentId: input.studentId,
        title: input.title.trim(),
        message: input.message.trim(),
        type: input.type || 'INFO',
        category: input.category || 'SYSTEM',
        isRead: false,
        entityId: input.entityId || null,
        link: input.link || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    // Real-time delivery via SSE
    const unreadCount = await prisma.notification.count({
      where: { studentId: input.studentId, isRead: false },
    });

    const event: NotificationDomainEvent = {
      type: 'NOTIFICATION_CREATED',
      notificationId: notification.id,
      unreadCount,
      timestamp: new Date().toISOString(),
    };

    complaintEventsService.emitNotificationEventToStudent(input.studentId, event);

    return notification;
  }

  /**
   * Retrieves paginated, sorted, and filtered notification list for an authenticated student.
   */
  async listNotifications(studentId: string, options: ListNotificationsOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = { studentId };

    if (options.unreadOnly) {
      whereClause.isRead = false;
    }

    if (options.category && options.category !== 'ALL') {
      whereClause.category = options.category.toUpperCase();
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { studentId, isRead: false } }),
    ]);

    const allCount = await prisma.notification.count({ where: { studentId } });

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
      readCount: Math.max(0, allCount - unreadCount),
    };
  }

  /**
   * Retrieves a single notification with strict recipient ownership check.
   */
  async getNotificationById(id: string, studentId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return null;
    }

    // Recipient ownership check (IDOR protection)
    if (notification.studentId !== studentId) {
      const error: any = new Error('Forbidden: You do not have permission to access this notification.');
      error.statusCode = 403;
      throw error;
    }

    return notification;
  }

  /**
   * Marks an individual notification as read.
   */
  async markAsRead(id: string, studentId: string) {
    const notification = await this.getNotificationById(id, studentId);
    if (!notification) {
      const error: any = new Error('Notification not found.');
      error.statusCode = 404;
      throw error;
    }

    let updated = notification;
    if (!notification.isRead) {
      updated = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: { studentId, isRead: false },
    });

    // Real-time SSE sync
    complaintEventsService.emitNotificationEventToStudent(studentId, {
      type: 'NOTIFICATION_READ',
      notificationId: updated.id,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    return {
      notification: updated,
      unreadCount,
    };
  }

  /**
   * Marks all unread notifications as read for the authenticated student.
   */
  async markAllAsRead(studentId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        studentId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Real-time SSE sync
    complaintEventsService.emitNotificationEventToStudent(studentId, {
      type: 'NOTIFICATIONS_ALL_READ',
      unreadCount: 0,
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return {
      markedCount: result.count,
      unreadCount: 0,
    };
  }

  /**
   * Retrieves the authoritative unread notification count.
   */
  async getUnreadCount(studentId: string) {
    const count = await prisma.notification.count({
      where: { studentId, isRead: false },
    });
    return { unreadCount: count };
  }
}

export const notificationService = new NotificationService();
