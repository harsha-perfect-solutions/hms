import { Response } from 'express';
import { EventEmitter } from 'events';

export type ComplaintEventType =
  | 'COMPLAINT_CREATED'
  | 'COMPLAINT_UPDATED'
  | 'COMPLAINT_STATUS_CHANGED'
  | 'COMPLAINT_RESOLVED'
  | 'COMPLAINT_CLOSED'
  | 'COMPLAINT_CANCELLED'
  | 'COMPLAINT_COMMENT_ADDED'
  | 'COMPLAINT_ATTACHMENT_ADDED';

export interface ComplaintDomainEvent {
  type: ComplaintEventType;
  complaintId: string;
  timestamp: string;
}

export type LeaveEventType =
  | 'LEAVE_CREATED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'LEAVE_CANCELLED'
  | 'LEAVE_STATUS_CHANGED'
  | 'SUSPENSION_CREATED'
  | 'SUSPENSION_UPDATED'
  | 'SUSPENSION_LIFTED';

export interface LeaveDomainEvent {
  type: LeaveEventType;
  leaveId?: string;
  suspensionId?: string;
  timestamp: string;
}

export type NotificationEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'NOTIFICATIONS_ALL_READ';

export interface NotificationDomainEvent {
  type: NotificationEventType;
  notificationId?: string;
  unreadCount?: number;
  count?: number;
  timestamp: string;
}

export type BiometricEventType =
  | 'BIOMETRIC_EVENT_RECORDED';

export interface BiometricDomainEvent {
  type: BiometricEventType;
  eventId?: string;
  eventType?: 'ENTRY' | 'EXIT' | string;
  status?: 'VERIFIED' | 'REJECTED' | string;
  gate?: string | null;
  timestamp: string;
}


class ComplaintEventsService extends EventEmitter {
  // Map of studentId -> Set of active SSE Response connections
  private studentConnections: Map<string, Set<Response>> = new Map();
  // Map of managerId -> Set of active SSE Response connections
  private managementConnections: Map<string, Set<Response>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  /**
   * Registers an SSE client connection for an authenticated student
   */
  public registerClient(studentId: string, res: Response): void {
    if (!this.studentConnections.has(studentId)) {
      this.studentConnections.set(studentId, new Set());
    }

    const connections = this.studentConnections.get(studentId)!;
    connections.add(res);

    // Initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: new Date().toISOString() })}\n\n`);

    // Clean up when client disconnects
    res.on('close', () => {
      this.removeClient(studentId, res);
    });
  }

  /**
   * Unregisters an SSE client connection
   */
  public removeClient(studentId: string, res: Response): void {
    const connections = this.studentConnections.get(studentId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.studentConnections.delete(studentId);
      }
    }
  }

  /**
   * Registers an SSE client connection for an authenticated management user
   */
  public registerManagementClient(managerId: string, res: Response): void {
    if (!this.managementConnections.has(managerId)) {
      this.managementConnections.set(managerId, new Set());
    }

    const connections = this.managementConnections.get(managerId)!;
    connections.add(res);

    // Initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, role: 'MANAGEMENT', timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.removeManagementClient(managerId, res);
    });
  }

  /**
   * Unregisters an SSE management connection
   */
  public removeManagementClient(managerId: string, res: Response): void {
    const connections = this.managementConnections.get(managerId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.managementConnections.delete(managerId);
      }
    }
  }

  /**
   * Broadcasts a real-time operational update to all connected management dashboards
   */
  public emitManagementDashboardUpdate(event: { type: string; timestamp: string; details?: any }): void {
    const payload = `event: management_dashboard_event\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [, connections] of this.managementConnections.entries()) {
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE event to management connection:', err);
        }
      }
    }
  }

  /**
   * Emits a domain event exclusively to the authorized student
   */
  public emitToStudent(studentId: string, event: ComplaintDomainEvent): void {
    // Notify student
    const connections = this.studentConnections.get(studentId);
    if (connections && connections.size > 0) {
      const payload = `event: complaint_event\ndata: ${JSON.stringify(event)}\n\n`;
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE event to connection:', err);
        }
      }
    }

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: { complaintId: event.complaintId },
    });
  }

  /**
   * Emits a leave domain event exclusively to the authorized student
   */
  public emitLeaveEventToStudent(studentId: string, event: LeaveDomainEvent): void {
    // Notify student
    const connections = this.studentConnections.get(studentId);
    if (connections && connections.size > 0) {
      const payload = `event: leave_event\ndata: ${JSON.stringify(event)}\n\n`;
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE leave event to connection:', err);
        }
      }
    }

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: { leaveId: event.leaveId, suspensionId: event.suspensionId },
    });
  }

  /**
   * Emits a notification domain event exclusively to the authorized student
   */
  public emitNotificationEventToStudent(studentId: string, event: NotificationDomainEvent): void {
    const connections = this.studentConnections.get(studentId);
    if (!connections || connections.size === 0) {
      return;
    }

    const payload = `event: notification_event\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of connections) {
      try {
        res.write(payload);
      } catch (err) {
        console.error('Failed to write SSE notification event to connection:', err);
      }
    }
  }

  /**
   * Dispatches a lightweight biometric event to a specific student's SSE stream
   */
  public emitBiometricEventToStudent(studentId: string, event: BiometricDomainEvent): void {
    const connections = this.studentConnections.get(studentId);
    if (!connections || connections.size === 0) {
      return;
    }

    const payload = `event: biometric_event\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of connections) {
      try {
        res.write(payload);
      } catch (err) {
        console.error('Failed to write SSE biometric event to connection:', err);
      }
    }

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: { eventId: event.eventId, gate: event.gate },
    });
  }

  /**
   * Keep-alive ping to prevent proxy/browser timeout
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      // Ping student connections
      for (const [, connections] of this.studentConnections.entries()) {
        for (const res of connections) {
          try {
            res.write(': ping\n\n');
          } catch {
            // connection dropped
          }
        }
      }
      // Ping management connections
      for (const [, connections] of this.managementConnections.entries()) {
        for (const res of connections) {
          try {
            res.write(': ping\n\n');
          } catch {
            // connection dropped
          }
        }
      }
    }, 25000);
  }

  /**
   * Diagnostics: get number of active subscribers
   */
  public getActiveConnectionCount(studentId?: string): number {
    if (studentId) {
      return this.studentConnections.get(studentId)?.size || 0;
    }
    let total = 0;
    for (const set of this.studentConnections.values()) {
      total += set.size;
    }
    return total;
  }
}

export const complaintEventsService = new ComplaintEventsService();
