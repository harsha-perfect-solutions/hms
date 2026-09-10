import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  AlertCircle,
  Paperclip,
  Download,
  Play,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  managementApiService,
  ComplaintStats,
  ManagementComplaintItem,
  MaintenanceStaffMember,
  ComplaintQueryParams,
} from '../services/api';
import { useManagementAuth } from '../context/ManagementAuthContext';

interface ManagementComplaintsPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementComplaintsPage: React.FC<ManagementComplaintsPageProps> = () => {
  const { user } = useManagementAuth();
  const isManagementRole = ['WARDEN', 'CHIEF_WARDEN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role || '');
  const isMaintenanceStaff = user?.role === 'MAINTENANCE_STAFF';

  // Statistics State
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Complaints List State
  const [complaints, setComplaints] = useState<ManagementComplaintItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [assignedFilter, setAssignedFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Maintenance Staff List (for assigning)
  const [staffList, setStaffList] = useState<MaintenanceStaffMember[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState<boolean>(false);

  // Live SSE Status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Action / Feedback Message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Detail Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<ManagementComplaintItem | null>(null);

  // Assign Modal State
  const [assigningComplaint, setAssigningComplaint] = useState<ManagementComplaintItem | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState<boolean>(false);

  // Resolve Modal State
  const [resolvingComplaint, setResolvingComplaint] = useState<ManagementComplaintItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolutionError, setResolutionError] = useState<string>('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState<boolean>(false);

  // Close Modal State
  const [closingComplaint, setClosingComplaint] = useState<ManagementComplaintItem | null>(null);
  const [isSubmittingClose, setIsSubmittingClose] = useState<boolean>(false);

  // Start Work Action State
  const [isSubmittingStart, setIsSubmittingStart] = useState<boolean>(false);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch Maintenance Staff
  const fetchStaff = useCallback(async () => {
    if (!isManagementRole) return;
    setIsStaffLoading(true);
    try {
      const res = await managementApiService.getMaintenanceStaff();
      if (res.success) {
        setStaffList(res.data);
      }
    } catch {
      // Ignored for non-fatal load
    } finally {
      setIsStaffLoading(false);
    }
  }, [isManagementRole]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Fetch KPI Statistics
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setIsStatsLoading(true);
    try {
      const res = await managementApiService.getComplaintStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err: any) {
      if (!silent) {
        setToastMessage({ type: 'error', text: err.message || 'Failed to load complaint statistics.' });
      }
    } finally {
      if (!silent) setIsStatsLoading(false);
    }
  }, []);

  // Fetch Complaints List
  const fetchComplaints = useCallback(
    async (pageToLoad = 1, silent = false) => {
      if (!silent) setIsListLoading(true);
      try {
        const queryParams: ComplaintQueryParams = {
          page: pageToLoad,
          limit: pagination.limit,
        };

        if (statusFilter !== 'ALL') queryParams.status = statusFilter;
        if (priorityFilter !== 'ALL') queryParams.priority = priorityFilter;
        if (categoryFilter !== 'ALL') queryParams.category = categoryFilter;
        if (assignedFilter !== 'ALL') queryParams.assigned = assignedFilter;
        if (searchTerm.trim()) queryParams.search = searchTerm.trim();

        const res = await managementApiService.getComplaints(queryParams);
        if (res.success) {
          setComplaints(res.data);
          setPagination({
            total: res.pagination.total,
            page: res.pagination.page,
            limit: res.pagination.limit,
            totalPages: res.pagination.totalPages,
          });
        }
      } catch (err: any) {
        if (!silent) {
          setToastMessage({ type: 'error', text: err.message || 'Failed to load complaints list.' });
        }
      } finally {
        if (!silent) setIsListLoading(false);
      }
    },
    [pagination.limit, statusFilter, priorityFilter, categoryFilter, assignedFilter, searchTerm]
  );

  // Initial Load & Filter Changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchComplaints(1);
  }, [fetchComplaints]);

  // SSE Subscription
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (!isMounted) return;
      setIsLiveConnected(true);

      const eventType = (event.type || event.eventType || '').toUpperCase();
      if (
        eventType.includes('COMPLAINT') ||
        eventType.includes('MAINTENANCE') ||
        eventType === 'MANAGEMENT_DASHBOARD_EVENT'
      ) {
        // Silently reload stats and list
        fetchStats(true);
        fetchComplaints(pagination.page, true);
      }
    });

    setIsLiveConnected(true);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchStats, fetchComplaints, pagination.page]);

  // Manual Refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(true), fetchComplaints(pagination.page, true), fetchStaff()]);
    setIsRefreshing(false);
    setToastMessage({ type: 'success', text: 'Complaints synchronized.' });
  };

  // Clear Filters
  const handleClearFilters = () => {
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setCategoryFilter('ALL');
    setAssignedFilter('ALL');
    setSearchTerm('');
  };

  // Open Detail Modal
  const handleViewDetail = async (complaintId: string) => {
    try {
      const res = await managementApiService.getComplaint(complaintId);
      if (res.success) {
        setSelectedComplaint(res.data);
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to load complaint details.' });
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = (complaint: ManagementComplaintItem) => {
    setAssigningComplaint(complaint);
    setSelectedStaffId(complaint.assignedToId || (staffList.length > 0 ? staffList[0].id : ''));
  };

  // Submit Assignment
  const handleConfirmAssign = async () => {
    if (!assigningComplaint || !selectedStaffId) return;
    setIsSubmittingAssign(true);
    try {
      const res = await managementApiService.assignComplaint(assigningComplaint.id, selectedStaffId);
      setToastMessage({ type: 'success', text: res.message || 'Complaint assigned successfully.' });
      setAssigningComplaint(null);
      if (selectedComplaint?.id === assigningComplaint.id) {
        handleViewDetail(assigningComplaint.id);
      }
      fetchStats(true);
      fetchComplaints(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to assign complaint.' });
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Start Work Action (ASSIGNED -> IN_PROGRESS)
  const handleStartWork = async (complaintId: string) => {
    setIsSubmittingStart(true);
    try {
      const res = await managementApiService.startComplaint(complaintId);
      setToastMessage({ type: 'success', text: res.message || 'Work started on complaint.' });
      if (selectedComplaint?.id === complaintId) {
        handleViewDetail(complaintId);
      }
      fetchStats(true);
      fetchComplaints(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to start work on complaint.' });
    } finally {
      setIsSubmittingStart(false);
    }
  };

  // Open Resolve Modal
  const handleOpenResolveModal = (complaint: ManagementComplaintItem) => {
    setResolvingComplaint(complaint);
    setResolutionNotes('');
    setResolutionError('');
  };

  // Submit Resolution
  const handleConfirmResolve = async () => {
    if (!resolvingComplaint) return;
    if (!resolutionNotes.trim() || resolutionNotes.trim().length < 10) {
      setResolutionError('Resolution notes must be at least 10 characters long.');
      return;
    }
    setIsSubmittingResolve(true);
    try {
      const res = await managementApiService.resolveComplaint(resolvingComplaint.id, resolutionNotes.trim());
      setToastMessage({ type: 'success', text: res.message || 'Complaint marked as resolved.' });
      setResolvingComplaint(null);
      if (selectedComplaint?.id === resolvingComplaint.id) {
        handleViewDetail(resolvingComplaint.id);
      }
      fetchStats(true);
      fetchComplaints(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to resolve complaint.' });
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Open Close Modal
  const handleOpenCloseModal = (complaint: ManagementComplaintItem) => {
    setClosingComplaint(complaint);
  };

  // Submit Close (RESOLVED -> CLOSED)
  const handleConfirmClose = async () => {
    if (!closingComplaint) return;
    setIsSubmittingClose(true);
    try {
      const res = await managementApiService.closeComplaint(closingComplaint.id);
      setToastMessage({ type: 'success', text: res.message || 'Complaint closed successfully.' });
      setClosingComplaint(null);
      if (selectedComplaint?.id === closingComplaint.id) {
        handleViewDetail(closingComplaint.id);
      }
      fetchStats(true);
      fetchComplaints(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to close complaint.' });
    } finally {
      setIsSubmittingClose(false);
    }
  };

  // Handle Attachment Download
  const handleDownloadAttachment = async (complaintId: string, attachmentId: string, fileName: string) => {
    try {
      await managementApiService.downloadComplaintAttachment(complaintId, attachmentId, fileName);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to download file.' });
    }
  };

  // Helper date formatters
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Priority Badge Renderer
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="complaint-priority-badge urgent">Urgent</span>;
      case 'HIGH':
        return <span className="complaint-priority-badge high">High</span>;
      case 'MEDIUM':
        return <span className="complaint-priority-badge medium">Medium</span>;
      case 'LOW':
      default:
        return <span className="complaint-priority-badge low">Low</span>;
    }
  };

  // Status Badge Renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="complaint-status-badge open">
            <AlertCircle size={12} />
            Open
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="complaint-status-badge assigned">
            <UserCheck size={12} />
            Assigned
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="complaint-status-badge in-progress">
            <Wrench size={12} />
            In Progress
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="complaint-status-badge resolved">
            <CheckCircle2 size={12} />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="complaint-status-badge closed">
            <ShieldCheck size={12} />
            Closed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="complaint-status-badge cancelled">
            <XCircle size={12} />
            Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="complaint-status-badge rejected">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return <span className="complaint-status-badge default">{status}</span>;
    }
  };

  // Can current user start work on this complaint?
  const canStartWork = (item: ManagementComplaintItem) => {
    if (item.status !== 'ASSIGNED') return false;
    if (isManagementRole) return true;
    if (isMaintenanceStaff && item.assignedToId === user?.id) return true;
    return false;
  };

  // Can current user resolve this complaint?
  const canResolve = (item: ManagementComplaintItem) => {
    if (item.status !== 'IN_PROGRESS') return false;
    if (isManagementRole) return true;
    if (isMaintenanceStaff && item.assignedToId === user?.id) return true;
    return false;
  };

  return (
    <div className="complaints-management-page">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`complaints-toast ${toastMessage.type}`} role="alert">
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="complaints-header-bar">
        <div className="complaints-title-group">
          <div className="complaints-icon-badge">
            <Wrench size={24} />
          </div>
          <div>
            <h1 className="complaints-main-title">
              {isMaintenanceStaff ? 'Maintenance Work Orders' : 'Complaints & Maintenance Operations'}
            </h1>
            <p className="complaints-sub-title">
              {isMaintenanceStaff
                ? 'View and execute assigned hostel maintenance tickets, track work progress, and record resolutions.'
                : 'Authoritative maintenance ticketing, staff assignment, work execution tracking, and formal closure.'}
            </p>
          </div>
        </div>

        <div className="complaints-controls-group">
          {/* Live Status Indicator */}
          <div className="live-indicator" title={isLiveConnected ? 'SSE Real-time Connected' : 'SSE Reconnecting...'}>
            <span className={`live-dot ${isLiveConnected ? 'connected' : 'disconnected'}`} />
            <span>{isLiveConnected ? 'Live Operations Active' : 'Connecting SSE...'}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            className="btn-secondary refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Synchronize complaints & stats"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="complaints-stats-grid">
        <div
          className="kpi-stat-card"
          onClick={() => setStatusFilter('ALL')}
          title="Click to view all complaints"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Total Tickets</span>
            <FileText size={18} className="kpi-icon total" />
          </div>
          <div className="kpi-stat-value">{isStatsLoading ? '—' : stats?.total ?? 0}</div>
          <div className="kpi-stat-sub">Recorded in hostel</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setStatusFilter('OPEN')}
          title="Filter by Open"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Open / New</span>
            <AlertCircle size={18} className="kpi-icon open" />
          </div>
          <div className="kpi-stat-value text-blue">{isStatsLoading ? '—' : stats?.open ?? 0}</div>
          <div className="kpi-stat-sub">Requires assignment</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setStatusFilter('ASSIGNED')}
          title="Filter by Assigned"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Assigned</span>
            <UserCheck size={18} className="kpi-icon assigned" />
          </div>
          <div className="kpi-stat-value text-purple">{isStatsLoading ? '—' : stats?.assigned ?? 0}</div>
          <div className="kpi-stat-sub">Awaiting technician start</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setStatusFilter('IN_PROGRESS')}
          title="Filter by In Progress"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">In Progress</span>
            <Wrench size={18} className="kpi-icon in-progress" />
          </div>
          <div className="kpi-stat-value text-amber">{isStatsLoading ? '—' : stats?.inProgress ?? 0}</div>
          <div className="kpi-stat-sub">Under repair</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setStatusFilter('RESOLVED')}
          title="Filter by Resolved"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Resolved</span>
            <CheckCircle2 size={18} className="kpi-icon resolved" />
          </div>
          <div className="kpi-stat-value text-green">{isStatsLoading ? '—' : stats?.resolved ?? 0}</div>
          <div className="kpi-stat-sub">Awaiting verification/close</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setStatusFilter('CLOSED')}
          title="Filter by Closed"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Closed</span>
            <ShieldCheck size={18} className="kpi-icon closed" />
          </div>
          <div className="kpi-stat-value text-slate">{isStatsLoading ? '—' : stats?.closed ?? 0}</div>
          <div className="kpi-stat-sub">Completed lifecycle</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setPriorityFilter('HIGH')}
          title="Filter by High/Urgent"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">High / Urgent</span>
            <AlertTriangle size={18} className="kpi-icon urgent" />
          </div>
          <div className="kpi-stat-value text-rose">{isStatsLoading ? '—' : stats?.highPriority ?? 0}</div>
          <div className="kpi-stat-sub">Priority attention</div>
        </div>

        <div
          className="kpi-stat-card clickable"
          onClick={() => setAssignedFilter('UNASSIGNED')}
          title="Filter by Unassigned"
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-stat-top">
            <span className="kpi-label">Unassigned</span>
            <Clock size={18} className="kpi-icon unassigned" />
          </div>
          <div className="kpi-stat-value text-orange">{isStatsLoading ? '—' : stats?.unassigned ?? 0}</div>
          <div className="kpi-stat-sub">No technician assigned</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="complaints-filter-bar">
        <div className="filter-input-group search-group">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search ticket #, student, title, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-search-input"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="clear-search-btn">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-select-group">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="filter-select-group">
          <label htmlFor="filter-priority">Priority</label>
          <select
            id="filter-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div className="filter-select-group">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Categories</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="PLUMBING">Plumbing</option>
            <option value="CARPENTRY">Carpentry</option>
            <option value="CLEANLINESS">Cleanliness</option>
            <option value="INTERNET">Internet</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {isManagementRole && (
          <div className="filter-select-group">
            <label htmlFor="filter-assigned">Assignment</label>
            <select
              id="filter-assigned"
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Tickets</option>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="ASSIGNED">Assigned to Staff</option>
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleClearFilters}
          className="btn-text clear-filters-btn"
          title="Reset all search and filter options"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Complaints Table & Content */}
      <div className="complaints-content-container">
        {isListLoading ? (
          <div className="complaints-loading-state">
            <RefreshCw size={28} className="spin" />
            <p>Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="complaints-empty-state">
            <Wrench size={40} className="empty-icon" />
            <h3>No Complaints Found</h3>
            <p>There are no complaints matching your current filters and permissions.</p>
            {(statusFilter !== 'ALL' ||
              priorityFilter !== 'ALL' ||
              categoryFilter !== 'ALL' ||
              assignedFilter !== 'ALL' ||
              searchTerm) && (
              <button type="button" onClick={handleClearFilters} className="btn-secondary mt-2">
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="complaints-table-wrapper desktop-only">
              <table className="complaints-table">
                <thead>
                  <tr>
                    <th>Ticket / Info</th>
                    <th>Student Details</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((item) => (
                    <tr key={item.id} className="complaint-row">
                      <td className="ticket-cell">
                        <div className="ticket-number-badge">
                          {item.ticketNumber || `CMP-${item.id.slice(-6).toUpperCase()}`}
                        </div>
                        <div className="complaint-title-text" title={item.title}>
                          {item.title}
                        </div>
                        {item.location && (
                          <div className="complaint-location-sub">
                            <MapPin size={11} />
                            <span>{item.location}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {item.student ? (
                          <div className="student-info-cell">
                            <span className="student-name">{item.student.name}</span>
                            <span className="student-jntu">{item.student.jntuNo}</span>
                            {(item.student.blockName || item.student.roomNumber) && (
                              <span className="student-room">
                                {item.student.blockName ? `${item.student.blockName} • ` : ''}
                                Room {item.student.roomNumber || '—'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="category-tag">{item.category}</span>
                      </td>
                      <td>{renderPriorityBadge(item.priority)}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td>
                        {item.assignedTo ? (
                          <div className="assigned-staff-info">
                            <UserCheck size={13} className="text-purple" />
                            <span>{item.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="unassigned-badge">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="date-cell">
                          <span>{formatDate(item.createdAt)}</span>
                          <span className="time-sub">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="actions-cell text-right">
                        <div className="action-buttons-group">
                          {/* View Detail Button */}
                          <button
                            type="button"
                            className="btn-action-icon view"
                            onClick={() => handleViewDetail(item.id)}
                            title="View ticket details"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Assign Button (Management only, for OPEN or ASSIGNED) */}
                          {isManagementRole && (item.status === 'OPEN' || item.status === 'ASSIGNED') && (
                            <button
                              type="button"
                              className="btn-action-primary assign-btn"
                              onClick={() => handleOpenAssignModal(item)}
                              title="Assign maintenance staff"
                            >
                              <UserCheck size={13} />
                              <span>{item.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</span>
                            </button>
                          )}

                          {/* Start Work Button (Assigned technician or Management) */}
                          {canStartWork(item) && (
                            <button
                              type="button"
                              className="btn-action-primary start-btn"
                              onClick={() => handleStartWork(item.id)}
                              disabled={isSubmittingStart}
                              title="Start work on ticket"
                            >
                              <Play size={13} />
                              <span>Start</span>
                            </button>
                          )}

                          {/* Resolve Button (Assigned technician or Management) */}
                          {canResolve(item) && (
                            <button
                              type="button"
                              className="btn-action-primary resolve-btn"
                              onClick={() => handleOpenResolveModal(item)}
                              title="Mark ticket as resolved"
                            >
                              <Check size={13} />
                              <span>Resolve</span>
                            </button>
                          )}

                          {/* Close Button (Management only, for RESOLVED) */}
                          {isManagementRole && item.status === 'RESOLVED' && (
                            <button
                              type="button"
                              className="btn-action-primary close-btn"
                              onClick={() => handleOpenCloseModal(item)}
                              title="Formally close verified complaint"
                            >
                              <ShieldCheck size={13} />
                              <span>Close</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="complaints-cards-wrapper mobile-only">
              {complaints.map((item) => (
                <div key={item.id} className="complaint-card">
                  <div className="complaint-card-header">
                    <span className="ticket-number-badge">
                      {item.ticketNumber || `CMP-${item.id.slice(-6).toUpperCase()}`}
                    </span>
                    <div className="complaint-card-badges">
                      {renderPriorityBadge(item.priority)}
                      {renderStatusBadge(item.status)}
                    </div>
                  </div>

                  <h3 className="complaint-card-title">{item.title}</h3>
                  <p className="complaint-card-desc">{item.description}</p>

                  {item.location && (
                    <div className="complaint-card-location">
                      <MapPin size={13} />
                      <span>{item.location}</span>
                    </div>
                  )}

                  <div className="complaint-card-meta-grid">
                    <div className="meta-block">
                      <span className="meta-label">Category</span>
                      <span className="meta-val">{item.category}</span>
                    </div>
                    <div className="meta-block">
                      <span className="meta-label">Student</span>
                      <span className="meta-val">{item.student?.name || '—'}</span>
                    </div>
                    <div className="meta-block">
                      <span className="meta-label">Assigned To</span>
                      <span className="meta-val">{item.assignedTo || 'Unassigned'}</span>
                    </div>
                    <div className="meta-block">
                      <span className="meta-label">Created</span>
                      <span className="meta-val">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  <div className="complaint-card-actions">
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() => handleViewDetail(item.id)}
                    >
                      <Eye size={14} />
                      <span>View Details</span>
                    </button>

                    {isManagementRole && (item.status === 'OPEN' || item.status === 'ASSIGNED') && (
                      <button
                        type="button"
                        className="btn-action-primary assign-btn w-full"
                        onClick={() => handleOpenAssignModal(item)}
                      >
                        <UserCheck size={14} />
                        <span>{item.status === 'ASSIGNED' ? 'Reassign Staff' : 'Assign Staff'}</span>
                      </button>
                    )}

                    {canStartWork(item) && (
                      <button
                        type="button"
                        className="btn-action-primary start-btn w-full"
                        onClick={() => handleStartWork(item.id)}
                        disabled={isSubmittingStart}
                      >
                        <Play size={14} />
                        <span>Start Work</span>
                      </button>
                    )}

                    {canResolve(item) && (
                      <button
                        type="button"
                        className="btn-action-primary resolve-btn w-full"
                        onClick={() => handleOpenResolveModal(item)}
                      >
                        <Check size={14} />
                        <span>Resolve Ticket</span>
                      </button>
                    )}

                    {isManagementRole && item.status === 'RESOLVED' && (
                      <button
                        type="button"
                        className="btn-action-primary close-btn w-full"
                        onClick={() => handleOpenCloseModal(item)}
                      >
                        <ShieldCheck size={14} />
                        <span>Close Complaint</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="complaints-pagination-bar">
                <span className="pagination-info">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tickets
                </span>
                <div className="pagination-buttons">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchComplaints(pagination.page - 1)}
                    className="btn-pagination"
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>
                  <span className="page-indicator">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchComplaints(pagination.page + 1)}
                    className="btn-pagination"
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* =========================================================================
          MODAL: COMPLAINT DETAIL
          ========================================================================= */}
      {selectedComplaint && (
        <div className="modal-backdrop" onClick={() => setSelectedComplaint(null)}>
          <div className="modal-dialog complaint-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="ticket-number-badge large">
                  {selectedComplaint.ticketNumber || `CMP-${selectedComplaint.id.slice(-6).toUpperCase()}`}
                </span>
                <h2>{selectedComplaint.title}</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedComplaint(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Badges Bar */}
              <div className="detail-badges-row">
                {renderPriorityBadge(selectedComplaint.priority)}
                {renderStatusBadge(selectedComplaint.status)}
                <span className="category-tag large">{selectedComplaint.category}</span>
                {selectedComplaint.location && (
                  <span className="location-pill">
                    <MapPin size={12} />
                    {selectedComplaint.location}
                  </span>
                )}
              </div>

              {/* Student Information Section */}
              {selectedComplaint.student && (
                <div className="detail-section student-card">
                  <h4 className="detail-section-heading">
                    <User size={15} />
                    <span>Resident Student Details</span>
                  </h4>
                  <div className="detail-grid student-info-grid">
                    <div>
                      <span className="detail-label">Name</span>
                      <span className="detail-value">{selectedComplaint.student.name}</span>
                    </div>
                    <div>
                      <span className="detail-label">JNTU Number</span>
                      <span className="detail-value font-mono">{selectedComplaint.student.jntuNo}</span>
                    </div>
                    <div>
                      <span className="detail-label">Block &amp; Room</span>
                      <span className="detail-value">
                        {selectedComplaint.student.blockName || '—'}, Room{' '}
                        {selectedComplaint.student.roomNumber || '—'}
                      </span>
                    </div>
                    {selectedComplaint.student.email && (
                      <div>
                        <span className="detail-label">Email</span>
                        <span className="detail-value">{selectedComplaint.student.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description Section */}
              <div className="detail-section">
                <h4 className="detail-section-heading">
                  <FileText size={15} />
                  <span>Problem Description</span>
                </h4>
                <div className="complaint-full-description">{selectedComplaint.description}</div>
              </div>

              {/* Lifecycle & Assignment Timeline */}
              <div className="detail-section">
                <h4 className="detail-section-heading">
                  <Clock size={15} />
                  <span>Operational Timeline &amp; Assignments</span>
                </h4>
                <div className="detail-timeline-grid">
                  <div className="timeline-item">
                    <span className="timeline-label">Created At</span>
                    <span className="timeline-val">{formatDateTime(selectedComplaint.createdAt)}</span>
                  </div>

                  <div className="timeline-item">
                    <span className="timeline-label">Assigned Technician</span>
                    <span className="timeline-val">
                      {selectedComplaint.assignedTo ? (
                        <span className="text-purple font-medium">{selectedComplaint.assignedTo}</span>
                      ) : (
                        <span className="text-muted">Not yet assigned</span>
                      )}
                    </span>
                    {selectedComplaint.assignedAt && (
                      <span className="timeline-sub">on {formatDateTime(selectedComplaint.assignedAt)}</span>
                    )}
                  </div>

                  {selectedComplaint.resolvedAt && (
                    <div className="timeline-item">
                      <span className="timeline-label">Resolved At</span>
                      <span className="timeline-val text-green font-medium">
                        {formatDateTime(selectedComplaint.resolvedAt)}
                      </span>
                      {selectedComplaint.resolvedBy && (
                        <span className="timeline-sub">by {selectedComplaint.resolvedBy}</span>
                      )}
                    </div>
                  )}

                  {selectedComplaint.closedAt && (
                    <div className="timeline-item">
                      <span className="timeline-label">Closed At</span>
                      <span className="timeline-val text-slate font-medium">
                        {formatDateTime(selectedComplaint.closedAt)}
                      </span>
                      {selectedComplaint.closedBy && (
                        <span className="timeline-sub">by {selectedComplaint.closedBy}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Notes Section */}
              {selectedComplaint.resolutionNotes && (
                <div className="detail-section resolution-notes-box">
                  <h4 className="detail-section-heading text-green">
                    <CheckCircle2 size={15} />
                    <span>Resolution Notes</span>
                  </h4>
                  <p className="resolution-notes-text">{selectedComplaint.resolutionNotes}</p>
                </div>
              )}

              {/* Attachments Section */}
              {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
                <div className="detail-section">
                  <h4 className="detail-section-heading">
                    <Paperclip size={15} />
                    <span>Attachments ({selectedComplaint.attachments.length})</span>
                  </h4>
                  <div className="attachments-list">
                    {selectedComplaint.attachments.map((att) => (
                      <div key={att.id} className="attachment-item-card">
                        <div className="attachment-meta">
                          <Paperclip size={14} className="attachment-icon" />
                          <div>
                            <span className="attachment-name">{att.fileName}</span>
                            <span className="attachment-size">
                              {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-download"
                          onClick={() =>
                            handleDownloadAttachment(selectedComplaint.id, att.id, att.fileName)
                          }
                          title="Download attachment"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedComplaint(null)}
              >
                Close Window
              </button>

              {/* Modal Quick Actions */}
              {isManagementRole &&
                (selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'ASSIGNED') && (
                  <button
                    type="button"
                    className="btn-action-primary assign-btn"
                    onClick={() => {
                      const c = selectedComplaint;
                      setSelectedComplaint(null);
                      handleOpenAssignModal(c);
                    }}
                  >
                    <UserCheck size={14} />
                    <span>{selectedComplaint.status === 'ASSIGNED' ? 'Reassign Staff' : 'Assign Staff'}</span>
                  </button>
                )}

              {canStartWork(selectedComplaint) && (
                <button
                  type="button"
                  className="btn-action-primary start-btn"
                  onClick={() => handleStartWork(selectedComplaint.id)}
                  disabled={isSubmittingStart}
                >
                  <Play size={14} />
                  <span>Start Work</span>
                </button>
              )}

              {canResolve(selectedComplaint) && (
                <button
                  type="button"
                  className="btn-action-primary resolve-btn"
                  onClick={() => {
                    const c = selectedComplaint;
                    setSelectedComplaint(null);
                    handleOpenResolveModal(c);
                  }}
                >
                  <Check size={14} />
                  <span>Resolve Complaint</span>
                </button>
              )}

              {isManagementRole && selectedComplaint.status === 'RESOLVED' && (
                <button
                  type="button"
                  className="btn-action-primary close-btn"
                  onClick={() => {
                    const c = selectedComplaint;
                    setSelectedComplaint(null);
                    handleOpenCloseModal(c);
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Close Ticket</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ASSIGN MAINTENANCE STAFF
          ========================================================================= */}
      {assigningComplaint && (
        <div className="modal-backdrop" onClick={() => setAssigningComplaint(null)}>
          <div className="modal-dialog assign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Maintenance Technician</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAssigningComplaint(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-ticket-summary">
                <span className="ticket-number-badge">
                  {assigningComplaint.ticketNumber || `CMP-${assigningComplaint.id.slice(-6).toUpperCase()}`}
                </span>
                <h4>{assigningComplaint.title}</h4>
                <p className="summary-desc">{assigningComplaint.description}</p>
                <div className="summary-meta">
                  <span>Category: <strong>{assigningComplaint.category}</strong></span>
                  <span>Priority: <strong>{assigningComplaint.priority}</strong></span>
                  {assigningComplaint.location && (
                    <span>Location: <strong>{assigningComplaint.location}</strong></span>
                  )}
                </div>
              </div>

              <div className="form-group mt-3">
                <label htmlFor="staff-select" className="form-label">
                  Select Maintenance Technician:
                </label>
                {isStaffLoading ? (
                  <p className="text-muted">Loading maintenance staff...</p>
                ) : staffList.length === 0 ? (
                  <div className="alert-box warning">
                    <AlertTriangle size={16} />
                    <span>No active maintenance technicians found in system.</span>
                  </div>
                ) : (
                  <select
                    id="staff-select"
                    className="form-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                  >
                    <option value="" disabled>
                      Choose technician...
                    </option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.jntuNo} • {staff.email})
                      </option>
                    ))}
                  </select>
                )}
                <span className="form-help">
                  The selected technician will be designated as the owner for work-order execution and resolution.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAssigningComplaint(null)}
                disabled={isSubmittingAssign}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action-primary assign-btn"
                onClick={handleConfirmAssign}
                disabled={isSubmittingAssign || !selectedStaffId}
              >
                <UserCheck size={14} />
                <span>{isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESOLVE COMPLAINT
          ========================================================================= */}
      {resolvingComplaint && (
        <div className="modal-backdrop" onClick={() => setResolvingComplaint(null)}>
          <div className="modal-dialog resolve-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Resolve Maintenance Complaint</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setResolvingComplaint(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-ticket-summary">
                <span className="ticket-number-badge">
                  {resolvingComplaint.ticketNumber || `CMP-${resolvingComplaint.id.slice(-6).toUpperCase()}`}
                </span>
                <h4>{resolvingComplaint.title}</h4>
                <p className="summary-desc">{resolvingComplaint.description}</p>
              </div>

              <div className="form-group mt-3">
                <label htmlFor="resolution-notes" className="form-label">
                  Resolution Notes <span className="text-danger">*</span> (min 10 characters):
                </label>
                <textarea
                  id="resolution-notes"
                  className={`form-textarea ${resolutionError ? 'input-error' : ''}`}
                  rows={4}
                  placeholder="Detail the repairs performed, replaced components, or maintenance outcome..."
                  value={resolutionNotes}
                  onChange={(e) => {
                    setResolutionNotes(e.target.value);
                    if (resolutionError) setResolutionError('');
                  }}
                />
                <div className="form-textarea-footer">
                  {resolutionError ? (
                    <span className="form-error-msg">{resolutionError}</span>
                  ) : (
                    <span className="form-help">Provide clear notes for verification before closing.</span>
                  )}
                  <span className={`char-count ${resolutionNotes.length < 10 ? 'text-danger' : 'text-green'}`}>
                    {resolutionNotes.length} / 10 min chars
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setResolvingComplaint(null)}
                disabled={isSubmittingResolve}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action-primary resolve-btn"
                onClick={handleConfirmResolve}
                disabled={isSubmittingResolve || resolutionNotes.trim().length < 10}
              >
                <Check size={14} />
                <span>{isSubmittingResolve ? 'Saving...' : 'Mark as Resolved'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CLOSE COMPLAINT CONFIRMATION
          ========================================================================= */}
      {closingComplaint && (
        <div className="modal-backdrop" onClick={() => setClosingComplaint(null)}>
          <div className="modal-dialog close-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Close Maintenance Ticket</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setClosingComplaint(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="alert-box info">
                <Info size={18} />
                <div>
                  <strong>Verification &amp; Final Closure</strong>
                  <p>
                    Closing this complaint signifies that the maintenance work has been inspected, confirmed
                    satisfactory, and the ticket lifecycle is completed.
                  </p>
                </div>
              </div>

              <div className="modal-ticket-summary mt-3">
                <span className="ticket-number-badge">
                  {closingComplaint.ticketNumber || `CMP-${closingComplaint.id.slice(-6).toUpperCase()}`}
                </span>
                <h4>{closingComplaint.title}</h4>
                {closingComplaint.resolutionNotes && (
                  <div className="resolution-notes-preview">
                    <strong>Resolution Notes:</strong>
                    <p>{closingComplaint.resolutionNotes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setClosingComplaint(null)}
                disabled={isSubmittingClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action-primary close-btn"
                onClick={handleConfirmClose}
                disabled={isSubmittingClose}
              >
                <ShieldCheck size={14} />
                <span>{isSubmittingClose ? 'Closing...' : 'Confirm Final Closure'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
