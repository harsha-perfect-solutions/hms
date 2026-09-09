export interface StudentUser {
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
}

export interface DashboardData {
  student: {
    id: string;
    jntuNo: string;
    name: string;
    email: string;
    role: string;
  };
  room: {
    status: 'ALLOCATED' | 'NOT_ALLOCATED' | 'PENDING';
    block?: string | null;
    roomNumber?: string | null;
    floor?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
  };
  outings: {
    active: number;
    usedThisMonth: number;
    limit: number;
  };
  mess: {
    bookedToday: number;
    meals: string[];
  };
  leaves: {
    active: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: string;
  }>;
}

export interface Roommate {
  id: string;
  name: string;
  jntuNo: string;
  bedNumber: string | null;
  allocationStatus: string;
  isCurrentStudent: boolean;
}

export interface MyRoomData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
  };
  allocation: {
    status: 'ALLOCATED' | 'NOT_ALLOCATED' | 'PENDING';
    block?: string | null;
    roomNumber?: string | null;
    floor?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
    allocatedAt?: string | null;
  };
  room: {
    block: string;
    roomNumber: string;
    floor: string;
    roomType: string;
    capacity: number;
    occupancy: number;
    occupancyStatus: string;
  } | null;
  roommates: Roommate[];
}

export interface MessMealSlot {
  mealType: 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';
  name: string;
  timing: string;
  description: string;
  status: 'AVAILABLE' | 'BOOKED' | 'USED' | 'EXPIRED' | 'UNAVAILABLE';
  token?: {
    id: string;
    tokenNumber: string;
    date: string;
    mealType: string;
    status: string;
    createdAt: string;
    timing?: string;
  } | null;
}

export interface ActiveMessToken {
  id: string;
  tokenNumber: string;
  date: string;
  mealType: string;
  mealName: string;
  timing: string;
  status: string;
  createdAt: string;
  studentName: string;
  jntuNo: string;
  blockName: string;
  roomNumber: string;
}

export interface MessTokenHistoryItem {
  id: string;
  tokenNumber?: string | null;
  date: string;
  mealType: string;
  mealName: string;
  timing: string;
  status: string;
  createdAt: string;
}

export interface MessTokensData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
  };
  today: {
    date: string;
    formattedDate: string;
    summary: {
      totalMeals: number;
      bookedCount: number;
      remainingCount: number;
      summaryStatus: string;
    };
    mealSlots: MessMealSlot[];
    activeTokensToday: ActiveMessToken[];
  };
  history: MessTokenHistoryItem[];
}

export interface BookTokenResponse {
  success: boolean;
  message: string;
  token?: {
    id: string;
    tokenNumber: string;
    mealType: string;
    mealName: string;
    date: string;
    status: string;
    timing: string;
    createdAt: string;
  };
}

export interface OutingRequestItem {
  id: string;
  requestNumber?: string | null;
  studentId: string;
  passType: 'LOCAL_OUTING' | 'EMERGENCY' | 'NIGHT_OUT';
  destination?: string | null;
  purpose: string;
  emergencyContact?: string | null;
  remarks?: string | null;
  outDate: string;
  returnDate: string;
  actualExitTime?: string | null;
  actualReturnTime?: string | null;
  rejectionReason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'OUT' | 'RETURNED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface OutingSummary {
  currentStatus: string;
  activeCount: number;
  pendingCount: number;
  usedThisMonth: number;
  monthlyLimit: number;
  remainingThisMonth: number;
}

export interface OutingRequestsData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
    blockName?: string | null;
    roomNumber?: string | null;
  };
  summary: OutingSummary;
  requests: OutingRequestItem[];
}

export interface CreateOutingPayload {
  passType: 'LOCAL_OUTING' | 'EMERGENCY' | 'NIGHT_OUT';
  destination: string;
  purpose: string;
  outDate: string;
  returnDate: string;
  emergencyContact?: string;
  remarks?: string;
}

export interface CreateOutingResponse {
  success: boolean;
  message: string;
  request: OutingRequestItem;
}

export interface CancelOutingResponse {
  success: boolean;
  message: string;
  request: OutingRequestItem;
}

export interface ComplaintCommentItem {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ComplaintAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  downloadUrl: string;
}

export interface ComplaintTimelineItem {
  step: string;
  label: string;
  description: string;
  timestamp?: string | null;
  completed: boolean;
}

export interface ComplaintItem {
  id: string;
  studentId: string;
  ticketNumber: string;
  category: string;
  title: string;
  description: string;
  location?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  comments?: string | null;
  commentsList?: ComplaintCommentItem[];
  attachments?: ComplaintAttachment[];
  timeline?: ComplaintTimelineItem[];
  createdAt: string;
  updatedAt: string;
}


export interface ComplaintSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  cancelled: number;
}

export interface ComplaintsData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
    blockName?: string | null;
    roomNumber?: string | null;
  };
  summary: ComplaintSummary;
  complaints: ComplaintItem[];
}

export interface CreateComplaintPayload {
  category: string;
  title: string;
  description: string;
  location?: string;
  priority?: string;
}

export interface CreateComplaintResponse {
  success: boolean;
  message: string;
  complaint: ComplaintItem;
}

export interface AddCommentResponse {
  success: boolean;
  message: string;
  comment: ComplaintCommentItem;
  complaint: ComplaintItem;
}

export interface CancelComplaintResponse {
  success: boolean;
  message: string;
  complaint: ComplaintItem;
}

export interface LeaveTimelineStep {
  step: string;
  title: string;
  timestamp: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface LeaveRequestItem {
  id: string;
  requestNumber?: string | null;
  studentId: string;
  leaveType: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact: string | null;
  remarks: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  status: string;
  effectiveStatus: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  durationDays: number;
  createdAt: string;
  updatedAt: string;
  canCancel?: boolean;
  timeline?: LeaveTimelineStep[];
}

export interface SuspensionInfo {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  remarks?: string | null;
}

export interface LeavesData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  currentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
  activeSuspension: SuspensionInfo | null;
  activeLeave: LeaveRequestItem | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    active: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  requests: LeaveRequestItem[];
}

export interface CreateLeavePayload {
  leaveType: string;
  destination: string;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact?: string;
}

export interface NotificationItem {
  id: string;
  studentId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  category: 'OUTING' | 'LEAVE' | 'COMPLAINT' | 'MESS' | 'SUSPENSION' | 'ROOM' | 'SYSTEM';
  isRead: boolean;
  readAt?: string | null;
  entityId?: string | null;
  link?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface NotificationsListData {
  success: boolean;
  notifications: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
  readCount: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: StudentUser;
}

const TOKEN_STORAGE_KEY = 'hms_student_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {
      console.error('Failed to persist auth token', e);
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to remove auth token', e);
    }
  },
};

export const apiService = {
  /**
   * Submit student credentials for authentication
   */
  async login(jntuNo: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jntuNo, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to sign in right now. Please try again.');
      }

      if (data.token) {
        authStorage.setToken(data.token);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your network connection.');
      }
      throw err;
    }
  },

  /**
   * Invalidate authenticated session on server and clear local token
   */
  async logout(): Promise<void> {
    const token = authStorage.getToken();
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.warn('Server logout error (proceeding with local clear):', e);
    } finally {
      authStorage.clearToken();
    }
  },

  /**
   * Fetch current session profile
   */
  async getMe(): Promise<StudentUser | null> {
    const token = authStorage.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          authStorage.clearToken();
        }
        return null;
      }

      const data = await response.json();
      return data.user || null;
    } catch (err) {
      console.error('Session check error:', err);
      return null;
    }
  },

  /**
   * Fetch complete authenticated student dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/dashboard', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load your hostel dashboard.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's accommodation and room details
   */
  async getMyRoomData(): Promise<MyRoomData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/my-room', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load room information.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's mess tokens, meal slots, and booking history
   */
  async getMessTokensData(): Promise<MessTokensData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess-tokens', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load mess token information.');
    }

    return data;
  },

  /**
   * Book an available meal token
   */
  async bookMessToken(mealType: string, date?: string): Promise<BookTokenResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess-tokens/book', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mealType, date }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to book mess token.');
    }

    return data;
  },

  /**
   * Fetch student's outing summary, active status, and request history
   */
  async getOutingRequestsData(): Promise<OutingRequestsData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/outing-requests', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load outing requests.');
    }

    return data;
  },

  /**
   * Submit a new outing request
   */
  async createOutingRequest(payload: CreateOutingPayload): Promise<CreateOutingResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/outing-requests', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit outing request.');
    }

    return data;
  },

  /**
   * Cancel an eligible pending outing request
   */
  async cancelOutingRequest(id: string): Promise<CancelOutingResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/outing-requests/${id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to cancel outing request.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's complaints data
   */
  async getComplaintsData(): Promise<ComplaintsData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/complaints', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load complaints.');
    }

    return data;
  },

  /**
   * Submit a new maintenance complaint
   */
  async createComplaint(payload: CreateComplaintPayload): Promise<CreateComplaintResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/complaints', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit complaint.');
    }

    return data;
  },

  /**
   * Add a follow-up note/comment to an active complaint
   */
  async addComplaintComment(id: string, comment: string): Promise<AddCommentResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}/comment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add note.');
    }

    return data;
  },

  /**
   * Cancel an eligible open complaint
   */
  async cancelComplaint(id: string): Promise<CancelComplaintResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to cancel complaint.');
    }

    return data;
  },

  /**
   * Fetch complete authoritative complaint details including attachments and timeline
   * Phase 2 & 3
   */
  async getComplaintDetail(id: string): Promise<{ success: boolean; complaint: ComplaintItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load complaint details.');
    }

    return data;
  },

  /**
   * Upload an attachment to an existing complaint
   * Phase 5 & 6
   */
  async uploadComplaintAttachment(
    complaintId: string,
    file: File
  ): Promise<{ success: boolean; message: string; attachment: ComplaintAttachment }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/student/complaints/${complaintId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload attachment.');
    }

    return data;
  },

  /**
   * Subscribe to real-time complaint updates via Server-Sent Events (SSE)
   * Phase 8, 10 & 11
   */
  subscribeToComplaintEvents(onEvent: (event: { type: string; complaintId: string; timestamp: string }) => void): () => void {
    const token = authStorage.getToken();
    if (!token) {
      return () => {};
    }

    let isClosed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      if (isClosed) return;
      try {
        eventSource = new EventSource(`/api/student/complaints/events?token=${encodeURIComponent(token)}`);

        eventSource.addEventListener('complaint_event', (e) => {
          try {
            const parsed = JSON.parse(e.data);
            onEvent(parsed);
          } catch (err) {
            console.error('Error parsing SSE event data:', err);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            // Reconnect after 3 seconds
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to establish SSE connection:', err);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    // Return cleanup function
    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  /**
   * Fetch all leaves, active suspension, and summary stats
   */
  async getLeaves(): Promise<LeavesData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/leaves', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load leave information.');
    }
    return data;
  },

  /**
   * Fetch detailed authoritative leave record with timeline
   */
  async getLeaveDetail(id: string): Promise<{ success: boolean; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/leaves/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load leave details.');
    }
    return data;
  },

  /**
   * Apply for a new leave request
   */
  async createLeave(payload: CreateLeavePayload): Promise<{ success: boolean; message: string; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/leaves', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit leave application.');
    }
    return data;
  },

  /**
   * Cancel a pending leave request
   */
  async cancelLeave(id: string): Promise<{ success: boolean; message: string; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/leaves/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to cancel leave request.');
    }
    return data;
  },

  /**
   * Subscribe to real-time leave & suspension events via SSE
   */
  subscribeToLeaveEvents(onEvent: (event: { type: string; leaveId?: string; suspensionId?: string; timestamp: string }) => void): () => void {
    const token = authStorage.getToken();
    if (!token) {
      return () => {};
    }

    let isClosed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      if (isClosed) return;
      try {
        eventSource = new EventSource(`/api/student/complaints/events?token=${encodeURIComponent(token)}`);

        eventSource.addEventListener('leave_event', (e) => {
          try {
            const parsed = JSON.parse(e.data);
            onEvent(parsed);
          } catch (err) {
            console.error('Error parsing SSE leave event data:', err);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to establish SSE connection for leaves:', err);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  /**
   * Fetch paginated and filtered notifications list
   */
  async getNotifications(options: { page?: number; limit?: number; category?: string; unreadOnly?: boolean } = {}): Promise<NotificationsListData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const params = new URLSearchParams();
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.category && options.category !== 'ALL') params.append('category', options.category);
    if (options.unreadOnly) params.append('unreadOnly', 'true');

    const queryString = params.toString();
    const url = `/api/student/notifications${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load notifications.');
    }
    return data;
  },

  /**
   * Fetch a single notification detail
   */
  async getNotificationDetail(id: string): Promise<{ success: boolean; notification: NotificationItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/notifications/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load notification.');
    }
    return data;
  },

  /**
   * Mark a single notification as read
   */
  async markNotificationAsRead(id: string): Promise<{ success: boolean; notification: NotificationItem; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark notification as read.');
    }
    return data;
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllNotificationsAsRead(): Promise<{ success: boolean; markedCount: number; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark all as read.');
    }
    return data;
  },

  /**
   * Get authoritative unread notification count
   */
  async getUnreadNotificationCount(): Promise<{ success: boolean; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/notifications/unread-count', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to retrieve unread notification count.');
    }
    return data;
  },

  /**
   * Subscribe to real-time notification events via SSE
   */
  subscribeToNotificationEvents(onEvent: (event: { type: string; notificationId?: string; unreadCount?: number; timestamp: string }) => void): () => void {
    const token = authStorage.getToken();
    if (!token) {
      return () => {};
    }

    let isClosed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      if (isClosed) return;
      try {
        eventSource = new EventSource(`/api/student/notifications/events?token=${encodeURIComponent(token)}`);

        eventSource.addEventListener('notification_event', (e) => {
          try {
            const parsed = JSON.parse(e.data);
            onEvent(parsed);
          } catch (err) {
            console.error('Error parsing SSE notification event:', err);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to connect to notification SSE:', err);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  /**
   * Biometric Tracking APIs (Step 9)
   */
  async getBiometricOverview(params?: {
    page?: number;
    limit?: number;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    eventType?: string;
    verificationStatus?: string;
  }): Promise<BiometricOverviewData> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.dateRange) query.append('dateRange', params.dateRange);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.eventType) query.append('eventType', params.eventType);
    if (params?.verificationStatus) query.append('verificationStatus', params.verificationStatus);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`/api/student/biometric${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch biometric overview.');
    return data;
  },

  async getBiometricToday(): Promise<{
    success: boolean;
    today: BiometricTodayStatus;
    todayEvents: BiometricEventItem[];
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch('/api/student/biometric/today', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch today biometric state.');
    return data;
  },

  async getBiometricSummary(days: number = 7): Promise<{
    success: boolean;
    dailySummaries: DailyAttendanceSummary[];
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch(`/api/student/biometric/summary?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch daily biometric summaries.');
    return data;
  },

  async getBiometricEventDetail(id: string): Promise<{
    success: boolean;
    event: BiometricEventItem;
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch(`/api/student/biometric/events/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch biometric event details.');
    return data;
  },

  subscribeToBiometricEvents(onEvent: (event: any) => void): () => void {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        eventSource = new EventSource(`/api/student/biometric/events-stream?token=${encodeURIComponent(token)}`);

        eventSource.addEventListener('biometric_event', (e) => {
          try {
            const parsed = JSON.parse(e.data);
            onEvent(parsed);
          } catch (err) {
            console.error('Error parsing SSE biometric event:', err);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to connect to biometric SSE:', err);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },
};

export interface BiometricEventItem {
  id: string;
  studentId: string;
  eventType: 'ENTRY' | 'EXIT';
  direction: 'IN' | 'OUT';
  verificationStatus: 'VERIFIED' | 'REJECTED';
  eventTimestamp: string;
  source: string;
  gate: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  rejectionReason: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface BiometricTodayStatus {
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  statusLabel: string;
  firstEntry: string | null;
  lastExit: string | null;
  entryCount: number;
  exitCount: number;
  latestEvent: BiometricEventItem | null;
  approximateHoursInside: number;
}

export interface DailyAttendanceSummary {
  date: string;
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  firstEntry: string | null;
  lastExit: string | null;
  entryCount: number;
  exitCount: number;
  totalEvents: number;
  approximateHoursInside: number;
}

export interface BiometricOverviewData {
  success: boolean;
  today: BiometricTodayStatus;
  events: BiometricEventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* =========================================================================
   STEP 10 — MANAGEMENT DASHBOARD TYPES & API SERVICE
   ========================================================================= */

export interface ManagementUser {
  id: string;
  jntuNo: string;
  name: string;
  email?: string | null;
  role: 'WARDEN' | 'CHIEF_WARDEN' | 'ADMIN' | 'HOSTEL_ADMIN' | string;
  blockName?: string | null;
}

export interface ResidentPresenceMetrics {
  totalResidents: number;
  activeResidents: number;
  currentlyInside: number;
  currentlyOutside: number;
  onLeave: number;
  suspended: number;
}

export interface RoomOccupancyMetrics {
  totalRooms: number;
  totalCapacity: number;
  allocatedBeds: number;
  occupied: number;
  partiallyOccupied: number;
  vacant: number;
  occupancyPercentage: number;
}

export interface RequestMetrics {
  pendingOutings: number;
  approvedOutings: number;
  outOutings: number;
  pendingLeaves: number;
  activeLeaves: number;
  openComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  activeSuspensions: number;
  actionableTotal: number;
}

export interface AttentionItem {
  id: string;
  category: string;
  title: string;
  description: string;
  count: number;
  urgency: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetModule: string;
  isAvailable: boolean;
}

export interface ManagementActivityItem {
  id: string;
  activityType: string;
  description: string;
  timestamp: string;
  student: {
    name: string;
    jntuNo: string;
    blockName?: string | null;
    roomNumber?: string | null;
  } | null;
}

export interface ManagementBiometricLog {
  id: string;
  eventType: 'ENTRY' | 'EXIT';
  verificationStatus: 'VERIFIED' | 'REJECTED';
  eventTimestamp: string;
  gate: string | null;
  student: {
    name: string;
    jntuNo: string;
  };
}

export interface ManagementDashboardData {
  success: boolean;
  user?: ManagementUser;
  residents: ResidentPresenceMetrics;
  rooms: RoomOccupancyMetrics;
  requests: RequestMetrics;
  attention: AttentionItem[];
  recentActivity: ManagementActivityItem[];
  recentBiometricEvents: ManagementBiometricLog[];
  systemStatus?: {
    database: string;
    serverTime: string;
    biometricSync: string;
  };
}

export interface ManagementLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: ManagementUser;
}

const MANAGEMENT_TOKEN_STORAGE_KEY = 'hms_management_auth_token';

export const managementAuthStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(MANAGEMENT_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(MANAGEMENT_TOKEN_STORAGE_KEY, token);
    } catch (e) {
      console.error('Failed to persist management auth token', e);
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(MANAGEMENT_TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to remove management auth token', e);
    }
  },
};

export const managementApiService = {
  async login(identifier: string, password: string): Promise<ManagementLoginResponse> {
    try {
      const response = await fetch('/api/management/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please verify credentials.');
      }

      if (data.token) {
        managementAuthStorage.setToken(data.token);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to management service. Please check your connection.');
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    const token = managementAuthStorage.getToken();
    try {
      if (token) {
        await fetch('/api/management/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.warn('Management logout error:', e);
    } finally {
      managementAuthStorage.clearToken();
    }
  },

  async getMe(): Promise<ManagementUser | null> {
    const token = managementAuthStorage.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/management/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          managementAuthStorage.clearToken();
        }
        return null;
      }

      const data = await response.json();
      return data.user || null;
    } catch (err) {
      console.error('Management session check error:', err);
      return null;
    }
  },

  async getDashboard(): Promise<ManagementDashboardData> {
    const token = managementAuthStorage.getToken();
    if (!token) {
      throw new Error('Management session missing. Please log in.');
    }

    const response = await fetch('/api/management/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        managementAuthStorage.clearToken();
      }
      throw new Error(data.message || 'Failed to retrieve management dashboard data.');
    }

    // Backend wraps the authoritative data under the 'data' key
    // { success: true, data: { residents, rooms, requests, attention, recentActivity, recentBiometricEvents, systemStatus } }
    return { success: data.success, ...data.data } as ManagementDashboardData;
  },

  subscribeToEvents(
    onEvent: (event: any) => void,
    onConnectionChange?: (connected: boolean) => void
  ): () => void {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isClosed = false;

    const handleEvent = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.error('Error parsing SSE management update:', err);
      }
    };

    const connect = () => {
      if (isClosed) return;
      try {
        const token = managementAuthStorage.getToken();
        if (!token) return;

        eventSource = new EventSource(`/api/management/events-stream?token=${encodeURIComponent(token)}`);

        eventSource.onopen = () => {
          onConnectionChange?.(true);
        };

        eventSource.addEventListener('connected', () => {
          onConnectionChange?.(true);
        });

        eventSource.addEventListener('management_dashboard_event', handleEvent);
        eventSource.addEventListener('management_dashboard_update', handleEvent);
        eventSource.onmessage = handleEvent;

        eventSource.onerror = () => {
          onConnectionChange?.(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to connect to management SSE stream:', err);
        onConnectionChange?.(false);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      onConnectionChange?.(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },
};
