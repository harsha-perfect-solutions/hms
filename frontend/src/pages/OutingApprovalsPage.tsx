import React, { useState, useEffect, useCallback } from 'react';
import {
  Footprints,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  LogIn,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  Check,
  X,
  User,
  Calendar,
  ShieldCheck,
  Radio,
  FileText,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  managementApiService,
  OutingStats,
  ManagementOutingItem,
  ManagementOutingDetail,
  Block,
} from '../services/api';

interface OutingApprovalsPageProps {
  onNavigate?: (path: string) => void;
}

export const OutingApprovalsPage: React.FC<OutingApprovalsPageProps> = () => {
  // Statistics State
  const [stats, setStats] = useState<OutingStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Outings List State
  const [outings, setOutings] = useState<ManagementOutingItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [passTypeFilter, setPassTypeFilter] = useState<string>('ALL');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Residential Blocks for Filter
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Live SSE Status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Action / Feedback Message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [selectedOutingDetail, setSelectedOutingDetail] = useState<ManagementOutingDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Approve Confirmation Modal
  const [approvingOuting, setApprovingOuting] = useState<ManagementOutingItem | null>(null);
  const [isSubmittingApprove, setIsSubmittingApprove] = useState<boolean>(false);

  // Reject Modal
  const [rejectingOuting, setRejectingOuting] = useState<ManagementOutingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch Blocks
  useEffect(() => {
    let mounted = true;
    managementApiService
      .getBlocks()
      .then((res) => {
        if (mounted && res?.blocks) {
          setBlocks(res.blocks);
        }
      })
      .catch((err) => console.error('Failed to load blocks for filter:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Outing Statistics
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setIsStatsLoading(true);
    try {
      const res = await managementApiService.getOutingStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load outing stats:', err);
    } finally {
      if (!silent) setIsStatsLoading(false);
    }
  }, []);

  // Fetch Outings List
  const fetchOutings = useCallback(
    async (page = 1, silent = false) => {
      if (!silent) setIsListLoading(true);
      try {
        const res = await managementApiService.getOutings({
          status: statusFilter,
          search: searchTerm.trim() || undefined,
          passType: passTypeFilter !== 'ALL' ? passTypeFilter : undefined,
          blockId: blockFilter !== 'ALL' ? blockFilter : undefined,
          date: dateFilter || undefined,
          page,
          limit: 10,
        });

        if (res.success) {
          setOutings(res.data);
          setPagination(res.pagination);
        }
      } catch (err: any) {
        console.error('Failed to load outing requests:', err);
        setToastMessage({ type: 'error', text: err.message || 'Failed to retrieve outings.' });
      } finally {
        if (!silent) setIsListLoading(false);
      }
    },
    [statusFilter, searchTerm, passTypeFilter, blockFilter, dateFilter]
  );

  // Trigger initial fetches and on filter change
  useEffect(() => {
    fetchStats();
    fetchOutings(1);
  }, [fetchStats, fetchOutings]);

  // Real-time SSE synchronization
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        if (
          event?.type === 'OUTING_APPROVED' ||
          event?.type === 'OUTING_REJECTED' ||
          event?.type === 'OUTING_CREATED' ||
          event?.type === 'OUTING_EXIT_CONFIRMED' ||
          event?.type === 'OUTING_RETURN_CONFIRMED' ||
          event?.type === 'OUTING_STATS_UPDATED' ||
          event?.type === 'BIOMETRIC_EVENT_RECORDED'
        ) {
          fetchStats(true);
          fetchOutings(pagination.page, true);
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, [fetchStats, fetchOutings, pagination.page]);

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchOutings(pagination.page)]);
    setIsRefreshing(false);
    setToastMessage({ type: 'success', text: 'Outing data refreshed.' });
  };

  // Inspect Outing Detail
  const handleOpenDetail = async (outingId: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await managementApiService.getOutingDetail(outingId);
      if (res.success && res.data) {
        setSelectedOutingDetail(res.data);
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to open outing detail.' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Approve Outing
  const handleConfirmApprove = async () => {
    if (!approvingOuting) return;
    setIsSubmittingApprove(true);
    try {
      const res = await managementApiService.approveOuting(approvingOuting.id);
      setToastMessage({
        type: 'success',
        text: res.message || `Outing pass #${approvingOuting.requestNumber || approvingOuting.id} approved.`,
      });
      setApprovingOuting(null);
      if (selectedOutingDetail?.id === approvingOuting.id) {
        setSelectedOutingDetail(null);
      }
      fetchStats(true);
      fetchOutings(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to approve request.' });
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  // Reject Outing
  const handleConfirmReject = async () => {
    if (!rejectingOuting) return;
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setRejectionError('Please provide a reason of at least 3 characters.');
      return;
    }

    setIsSubmittingReject(true);
    try {
      const res = await managementApiService.rejectOuting(rejectingOuting.id, rejectionReason.trim());
      setToastMessage({
        type: 'success',
        text: res.message || `Outing pass #${rejectingOuting.requestNumber || rejectingOuting.id} rejected.`,
      });
      setRejectingOuting(null);
      setRejectionReason('');
      setRejectionError('');
      if (selectedOutingDetail?.id === rejectingOuting.id) {
        setSelectedOutingDetail(null);
      }
      fetchStats(true);
      fetchOutings(pagination.page, true);
    } catch (err: any) {
      setRejectionError(err.message || 'Failed to reject request.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSearchTerm('');
    setPassTypeFilter('ALL');
    setBlockFilter('ALL');
    setDateFilter('');
  };

  // Format Date Helper
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="outing-status-badge pending">
            <Clock size={12} />
            Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="outing-status-badge approved">
            <CheckCircle2 size={12} />
            Approved (Awaiting Exit)
          </span>
        );
      case 'ACTIVE':
      case 'OUT':
        return (
          <span className="outing-status-badge active">
            <LogOut size={12} />
            Outside Hostel
          </span>
        );
      case 'RETURNED':
        return (
          <span className="outing-status-badge returned">
            <LogIn size={12} />
            Returned
          </span>
        );
      case 'REJECTED':
        return (
          <span className="outing-status-badge rejected">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return <span className="outing-status-badge default">{status}</span>;
    }
  };

  return (
    <div className="outing-management-page">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`outing-toast ${toastMessage.type}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="toast-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Operational Bar */}
      <div className="outing-header-bar">
        <div className="outing-title-group">
          <div className="outing-icon-badge">
            <Footprints size={24} />
          </div>
          <div>
            <h1 className="outing-main-title">Outing Approvals &amp; Gate Transit</h1>
            <p className="outing-sub-title">
              Review and approve resident movement passes. Biometric gate correlations track physical exit and return.
            </p>
          </div>
        </div>

        <div className="outing-controls-group">
          <div className="live-indicator">
            <span className={`live-dot ${isLiveConnected ? 'connected' : 'disconnected'}`} />
            <span className="live-text">{isLiveConnected ? 'Live Gate Stream' : 'Connecting...'}</span>
          </div>

          <button
            type="button"
            className="btn-secondary refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh statistics and requests"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* KPI Statistics Section */}
      <div className="outing-kpi-grid">
        <div className="outing-kpi-card total">
          <div className="kpi-header">
            <span className="kpi-label">Total Outing Passes</span>
            <div className="kpi-icon-wrap total">
              <FileText size={18} />
            </div>
          </div>
          <div className="kpi-value">{isStatsLoading ? '—' : stats?.total ?? 0}</div>
          <div className="kpi-subtext">Cumulative registered passes</div>
        </div>

        <div className="outing-kpi-card pending-card">
          <div className="kpi-header">
            <span className="kpi-label">Pending Approval</span>
            <div className="kpi-icon-wrap pending">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value warning-text">{isStatsLoading ? '—' : stats?.pending ?? 0}</div>
          <div className="kpi-subtext">
            {(stats?.pending ?? 0) > 0 ? 'Action required by Warden' : 'All requests processed'}
          </div>
        </div>

        <div className="outing-kpi-card approved-card">
          <div className="kpi-header">
            <span className="kpi-label">Approved Passes</span>
            <div className="kpi-icon-wrap approved">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-value">{isStatsLoading ? '—' : stats?.approved ?? 0}</div>
          <div className="kpi-subtext">Awaiting biometric gate exit</div>
        </div>

        <div className="outing-kpi-card active-card">
          <div className="kpi-header">
            <span className="kpi-label">Currently Outside</span>
            <div className="kpi-icon-wrap active">
              <LogOut size={18} />
            </div>
          </div>
          <div className="kpi-value active-text">{isStatsLoading ? '—' : stats?.active ?? 0}</div>
          <div className="kpi-subtext">Verified physical exit at turnstile</div>
        </div>

        <div className="outing-kpi-card returned-card">
          <div className="kpi-header">
            <span className="kpi-label">Returned Passes</span>
            <div className="kpi-icon-wrap returned">
              <LogIn size={18} />
            </div>
          </div>
          <div className="kpi-value success-text">{isStatsLoading ? '—' : stats?.returned ?? 0}</div>
          <div className="kpi-subtext">Successfully checked back in</div>
        </div>

        <div className="outing-kpi-card rejected-card">
          <div className="kpi-header">
            <span className="kpi-label">Rejected Passes</span>
            <div className="kpi-icon-wrap rejected">
              <XCircle size={18} />
            </div>
          </div>
          <div className="kpi-value danger-text">{isStatsLoading ? '—' : stats?.rejected ?? 0}</div>
          <div className="kpi-subtext">Declined with recorded reason</div>
        </div>
      </div>

      {/* Main Operations Container */}
      <div className="outing-main-card">
        {/* Quick Filter Tabs */}
        <div className="outing-status-tabs">
          <button
            type="button"
            className={`status-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Passes
            <span className="tab-count">{stats?.total ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending
            <span className={`tab-count ${stats?.pending ? 'highlight-amber' : ''}`}>
              {stats?.pending ?? 0}
            </span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('APPROVED')}
          >
            Approved
            <span className="tab-count">{stats?.approved ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Outside Hostel
            <span className="tab-count">{stats?.active ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'RETURNED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('RETURNED')}
          >
            Returned
            <span className="tab-count">{stats?.returned ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'REJECTED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('REJECTED')}
          >
            Rejected
            <span className="tab-count">{stats?.rejected ?? 0}</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="outing-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by student name, JNTU No, request #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="search-clear-btn"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <div className="select-wrapper">
              <label htmlFor="outing-pass-type" className="sr-only">Pass Type</label>
              <select
                id="outing-pass-type"
                value={passTypeFilter}
                onChange={(e) => setPassTypeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Pass Types</option>
                <option value="LOCAL_OUTING">Local Outing</option>
                <option value="GENERAL_OUTING">General Outing</option>
                <option value="EMERGENCY">Medical / Emergency</option>
                <option value="NIGHT_OUT">Night Out</option>
                <option value="COACHING_TUITION">Coaching / Tuition</option>
                <option value="ACADEMIC_PROJECT">Academic / Project</option>
              </select>
            </div>

            <div className="select-wrapper">
              <label htmlFor="outing-block-filter" className="sr-only">Residential Block</label>
              <select
                id="outing-block-filter"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Residential Blocks</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="date-input-wrapper">
              <label htmlFor="outing-date-filter" className="sr-only">Filter by Date</label>
              <input
                id="outing-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="filter-date-input"
                title="Filter by transit date"
              />
            </div>

            {(statusFilter !== 'ALL' ||
              searchTerm ||
              passTypeFilter !== 'ALL' ||
              blockFilter !== 'ALL' ||
              dateFilter) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary reset-filter-btn"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Requests Table / Cards View */}
        {isListLoading ? (
          <div className="outing-loading-state">
            <RefreshCw size={28} className="spin" />
            <p>Loading outing requests from PostgreSQL...</p>
          </div>
        ) : outings.length === 0 ? (
          <div className="outing-empty-state">
            <Footprints size={40} className="empty-icon" />
            <h3>No Outing Requests Found</h3>
            <p>There are no resident outing records matching your selected filter criteria.</p>
            {(statusFilter !== 'ALL' || searchTerm || passTypeFilter !== 'ALL' || blockFilter !== 'ALL' || dateFilter) && (
              <button type="button" onClick={handleResetFilters} className="btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="outing-table-wrapper">
              <table className="outing-table">
                <thead>
                  <tr>
                    <th>Request #</th>
                    <th>Student Resident</th>
                    <th>Pass Type &amp; Destination</th>
                    <th>Departure / Return</th>
                    <th>Status</th>
                    <th>Gate Transit Log</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outings.map((item) => {
                    const isPending = item.status === 'PENDING';
                    const hasExit = Boolean(item.actualExitTime);
                    const hasReturn = Boolean(item.actualReturnTime);

                    return (
                      <tr key={item.id} className={`outing-row ${isPending ? 'pending-highlight' : ''}`}>
                        {/* Request # */}
                        <td>
                          <div className="request-num-cell">
                            <span className="request-num">{item.requestNumber || '—'}</span>
                            <span className="applied-time">{formatDateOnly(item.createdAt)}</span>
                          </div>
                        </td>

                        {/* Student Info */}
                        <td>
                          <div className="student-info-cell">
                            <span className="student-name">{item.student?.name || 'Resident'}</span>
                            <span className="student-sub">
                              {item.student?.jntuNo} •{' '}
                              {item.student?.blockName
                                ? `${item.student.blockName} (R-${item.student.roomNumber || '?'})`
                                : 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Pass Details */}
                        <td>
                          <div className="pass-details-cell">
                            <span className="pass-type-badge">
                              {item.passType?.replace(/_/g, ' ')}
                            </span>
                            <span className="destination-text" title={item.destination || ''}>
                              {item.destination || 'Unspecified'}
                            </span>
                          </div>
                        </td>

                        {/* Schedule */}
                        <td>
                          <div className="schedule-cell">
                            <div className="schedule-item">
                              <span className="schedule-label">Out:</span>
                              <span className="schedule-time">{formatDateTime(item.outDate)}</span>
                            </div>
                            <div className="schedule-item">
                              <span className="schedule-label">Back:</span>
                              <span className="schedule-time">{formatDateTime(item.returnDate)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td>{renderStatusBadge(item.status)}</td>

                        {/* Gate Transit Timings */}
                        <td>
                          <div className="transit-log-cell">
                            {hasExit ? (
                              <div className="transit-time exit">
                                <LogOut size={12} />
                                <span>Exit: {formatDateTime(item.actualExitTime)}</span>
                              </div>
                            ) : item.status === 'APPROVED' ? (
                              <span className="transit-pending">Awaiting Gate Exit</span>
                            ) : (
                              <span className="transit-none">—</span>
                            )}

                            {hasReturn ? (
                              <div className="transit-time return">
                                <LogIn size={12} />
                                <span>Return: {formatDateTime(item.actualReturnTime)}</span>
                              </div>
                            ) : hasExit ? (
                              <span className="transit-pending">Currently Outside</span>
                            ) : null}
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-buttons-group">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-action approve-btn"
                                  onClick={() => setApprovingOuting(item)}
                                  title="Approve Outing Pass"
                                >
                                  <Check size={14} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-action reject-btn"
                                  onClick={() => {
                                    setRejectingOuting(item);
                                    setRejectionReason('');
                                    setRejectionError('');
                                  }}
                                  title="Reject Outing Pass"
                                >
                                  <X size={14} />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn-action view-btn"
                                onClick={() => handleOpenDetail(item.id)}
                                title="Inspect Complete Pass Details"
                              >
                                <Eye size={14} />
                                <span>View</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (<768px) */}
            <div className="outing-cards-container">
              {outings.map((item) => {
                const isPending = item.status === 'PENDING';

                return (
                  <div key={item.id} className={`outing-mobile-card ${isPending ? 'pending' : ''}`}>
                    <div className="mobile-card-top">
                      <div className="mobile-card-req">
                        <span className="card-req-number">{item.requestNumber || item.id.slice(0, 8)}</span>
                        <span className="card-applied-date">{formatDateOnly(item.createdAt)}</span>
                      </div>
                      <div>{renderStatusBadge(item.status)}</div>
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-student-row">
                        <User size={15} className="mobile-icon" />
                        <div>
                          <strong>{item.student?.name || 'Resident'}</strong>
                          <span className="mobile-jntu">
                            {' '}
                            ({item.student?.jntuNo}) • {item.student?.blockName || 'Block ?'} - Room {item.student?.roomNumber || '?'}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-detail-row">
                        <span className="mobile-pass-type">{item.passType?.replace(/_/g, ' ')}</span>
                        <span className="mobile-dest">To: {item.destination || 'Unspecified'}</span>
                      </div>

                      <div className="mobile-timing-grid">
                        <div className="timing-box">
                          <span className="timing-lbl">Expected Exit</span>
                          <span className="timing-val">{formatDateTime(item.outDate)}</span>
                        </div>
                        <div className="timing-box">
                          <span className="timing-lbl">Expected Return</span>
                          <span className="timing-val">{formatDateTime(item.returnDate)}</span>
                        </div>
                      </div>

                      {(item.actualExitTime || item.actualReturnTime) && (
                        <div className="mobile-transit-box">
                          {item.actualExitTime && (
                            <div>
                              <LogOut size={12} className="inline-icon" /> Exit recorded: {formatDateTime(item.actualExitTime)}
                            </div>
                          )}
                          {item.actualReturnTime && (
                            <div>
                              <LogIn size={12} className="inline-icon" /> Return recorded: {formatDateTime(item.actualReturnTime)}
                            </div>
                          )}
                        </div>
                      )}

                      {item.rejectionReason && (
                        <div className="mobile-rejection-box">
                          <strong>Rejection Reason:</strong> {item.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div className="mobile-card-actions">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            className="btn-action approve-btn mobile-full"
                            onClick={() => setApprovingOuting(item)}
                          >
                            <Check size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            className="btn-action reject-btn mobile-full"
                            onClick={() => {
                              setRejectingOuting(item);
                              setRejectionReason('');
                              setRejectionError('');
                            }}
                          >
                            <X size={14} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-action view-btn mobile-full"
                          onClick={() => handleOpenDetail(item.id)}
                        >
                          <Eye size={14} />
                          <span>View Complete Details</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="outing-pagination">
                <span className="pagination-summary">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchOutings(pagination.page - 1)}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span className="pagination-current">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchOutings(pagination.page + 1)}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {approvingOuting && (
        <div className="mgmt-modal-backdrop" onClick={() => setApprovingOuting(null)}>
          <div className="mgmt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon approve">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="modal-title">Approve Outing Pass</h3>
                <p className="modal-subtitle">Confirm authorization for resident movement</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setApprovingOuting(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-box">
                <div className="review-row">
                  <span className="review-label">Resident Name:</span>
                  <span className="review-val font-semibold">{approvingOuting.student?.name}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">JNTU Number:</span>
                  <span className="review-val">{approvingOuting.student?.jntuNo}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Pass Type:</span>
                  <span className="review-val">{approvingOuting.passType?.replace(/_/g, ' ')}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Destination:</span>
                  <span className="review-val">{approvingOuting.destination}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Purpose:</span>
                  <span className="review-val">{approvingOuting.purpose}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Expected Window:</span>
                  <span className="review-val">
                    {formatDateTime(approvingOuting.outDate)} → {formatDateTime(approvingOuting.returnDate)}
                  </span>
                </div>
              </div>

              <div className="notice-banner info">
                <Info size={16} className="notice-icon" />
                <p>
                  <strong>Security Note:</strong> Approving this pass permits the student to pass through the biometric turnstile. Physical transit (exit and entry) will be verified automatically by the gate devices.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setApprovingOuting(null)}
                disabled={isSubmittingApprove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary approve-confirm-btn"
                onClick={handleConfirmApprove}
                disabled={isSubmittingApprove}
              >
                {isSubmittingApprove ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingOuting && (
        <div className="mgmt-modal-backdrop" onClick={() => setRejectingOuting(null)}>
          <div className="mgmt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon reject">
                <XCircle size={20} />
              </div>
              <div>
                <h3 className="modal-title">Reject Outing Pass</h3>
                <p className="modal-subtitle">Provide a justification for rejecting request #{rejectingOuting.requestNumber || rejectingOuting.id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRejectingOuting(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-box compact">
                <div>
                  <strong>{rejectingOuting.student?.name}</strong> ({rejectingOuting.student?.jntuNo})
                </div>
                <div className="text-muted">
                  Destination: {rejectingOuting.destination} • Window: {formatDateOnly(rejectingOuting.outDate)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reject-reason">
                  Rejection Reason <span className="required-star">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  className="form-textarea"
                  placeholder="State clearly why this request cannot be approved (e.g., examination period restrictions, missing parental confirmation, curfew rules)..."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError('');
                  }}
                />
                <div className="form-helper-row">
                  <span className={`char-count ${rejectionReason.trim().length >= 3 ? 'valid' : ''}`}>
                    {rejectionReason.trim().length} / min 3 characters
                  </span>
                  {rejectionError && <span className="form-error-msg">{rejectionError}</span>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRejectingOuting(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger reject-confirm-btn"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || rejectionReason.trim().length < 3}
              >
                {isSubmittingReject ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTION DRAWER / MODAL */}
      {isLoadingDetail && (
        <div className="mgmt-modal-backdrop">
          <div className="mgmt-modal-card" style={{ padding: '2rem', textAlign: 'center', alignItems: 'center' }}>
            <RefreshCw size={32} className="spin" style={{ color: '#1E3A8A', marginBottom: '1rem' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Loading outing details...</p>
          </div>
        </div>
      )}

      {selectedOutingDetail && (
        <div className="mgmt-modal-backdrop" onClick={() => setSelectedOutingDetail(null)}>
          <div className="mgmt-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon detail">
                <Footprints size={20} />
              </div>
              <div>
                <h3 className="modal-title">
                  Outing Pass #{selectedOutingDetail.requestNumber || selectedOutingDetail.id.slice(0, 8)}
                </h3>
                <p className="modal-subtitle">Full resident profile and movement audit</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedOutingDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable">
              {/* Top Banner Status */}
              <div className="detail-status-banner">
                <div>
                  <span className="banner-label">Current Lifecycle State</span>
                  <div className="banner-badge-wrap">{renderStatusBadge(selectedOutingDetail.status)}</div>
                </div>
                <div className="monthly-usage-badge">
                  <span className="usage-num">{selectedOutingDetail.monthlyUsageCount}</span>
                  <span className="usage-lbl">Outings This Month</span>
                </div>
              </div>

              {/* Resident Info Section */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <User size={16} /> Resident Student Information
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Full Name</span>
                    <span className="cell-val font-semibold">{selectedOutingDetail.student?.name}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">JNTU Number</span>
                    <span className="cell-val">{selectedOutingDetail.student?.jntuNo}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Assigned Block</span>
                    <span className="cell-val">{selectedOutingDetail.student?.blockName || 'Unassigned'}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Room &amp; Bed</span>
                    <span className="cell-val">
                      Room {selectedOutingDetail.student?.roomNumber || '—'} (Bed {selectedOutingDetail.student?.bedNumber || 'Auto'})
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Email Address</span>
                    <span className="cell-val">{selectedOutingDetail.student?.email}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Emergency Contact</span>
                    <span className="cell-val">{selectedOutingDetail.emergencyContact || 'None provided'}</span>
                  </div>
                </div>
              </div>

              {/* Outing Request Details */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <Calendar size={16} /> Pass &amp; Schedule Details
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Pass Classification</span>
                    <span className="cell-val font-semibold">{selectedOutingDetail.passType?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Destination</span>
                    <span className="cell-val">{selectedOutingDetail.destination}</span>
                  </div>
                  <div className="info-cell full-width">
                    <span className="cell-lbl">Purpose</span>
                    <span className="cell-val">{selectedOutingDetail.purpose}</span>
                  </div>
                  {selectedOutingDetail.remarks && (
                    <div className="info-cell full-width">
                      <span className="cell-lbl">Resident Remarks</span>
                      <span className="cell-val">{selectedOutingDetail.remarks}</span>
                    </div>
                  )}
                  <div className="info-cell">
                    <span className="cell-lbl">Approved Departure Time</span>
                    <span className="cell-val">{formatDateTime(selectedOutingDetail.outDate)}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Approved Expected Return</span>
                    <span className="cell-val">{formatDateTime(selectedOutingDetail.returnDate)}</span>
                  </div>
                </div>
              </div>

              {/* Decision / Warden Audit */}
              {(selectedOutingDetail.approvedBy || selectedOutingDetail.rejectedBy) && (
                <div className="detail-section">
                  <h4 className="detail-section-title">
                    <ShieldCheck size={16} /> Decision &amp; Warden Audit
                  </h4>
                  <div className="detail-info-grid">
                    {selectedOutingDetail.approvedBy && (
                      <>
                        <div className="info-cell">
                          <span className="cell-lbl">Approved By</span>
                          <span className="cell-val font-semibold">{selectedOutingDetail.approvedBy}</span>
                        </div>
                        <div className="info-cell">
                          <span className="cell-lbl">Approved Timestamp</span>
                          <span className="cell-val">{formatDateTime(selectedOutingDetail.approvedAt)}</span>
                        </div>
                      </>
                    )}
                    {selectedOutingDetail.rejectedBy && (
                      <>
                        <div className="info-cell">
                          <span className="cell-lbl">Rejected By</span>
                          <span className="cell-val font-semibold text-danger">{selectedOutingDetail.rejectedBy}</span>
                        </div>
                        <div className="info-cell">
                          <span className="cell-lbl">Rejection Timestamp</span>
                          <span className="cell-val">{formatDateTime(selectedOutingDetail.rejectedAt)}</span>
                        </div>
                        <div className="info-cell full-width">
                          <span className="cell-lbl">Official Rejection Reason</span>
                          <span className="cell-val text-danger">{selectedOutingDetail.rejectionReason}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Biometric Transit Gate Verification */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <Radio size={16} /> Biometric Gate Verification Logs
                </h4>
                <div className="transit-cards-grid">
                  <div className={`transit-status-box ${selectedOutingDetail.actualExitTime ? 'completed' : 'waiting'}`}>
                    <div className="transit-box-header">
                      <LogOut size={16} />
                      <span>Physical Exit Gate</span>
                    </div>
                    <div className="transit-box-body">
                      {selectedOutingDetail.actualExitTime ? (
                        <>
                          <div className="transit-box-time">{formatDateTime(selectedOutingDetail.actualExitTime)}</div>
                          <span className="transit-tag verified">Verified Turnstile Exit</span>
                        </>
                      ) : (
                        <div className="transit-box-empty">No exit scan recorded yet</div>
                      )}
                    </div>
                  </div>

                  <div className={`transit-status-box ${selectedOutingDetail.actualReturnTime ? 'completed' : 'waiting'}`}>
                    <div className="transit-box-header">
                      <LogIn size={16} />
                      <span>Physical Entry Gate</span>
                    </div>
                    <div className="transit-box-body">
                      {selectedOutingDetail.actualReturnTime ? (
                        <>
                          <div className="transit-box-time">{formatDateTime(selectedOutingDetail.actualReturnTime)}</div>
                          <span className="transit-tag verified">Verified Turnstile Entry</span>
                        </>
                      ) : (
                        <div className="transit-box-empty">No return scan recorded yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {selectedOutingDetail.status === 'PENDING' && (
                <div className="footer-left-actions">
                  <button
                    type="button"
                    className="btn-action approve-btn"
                    onClick={() => {
                      setApprovingOuting(selectedOutingDetail);
                    }}
                  >
                    <Check size={14} /> Approve Pass
                  </button>
                  <button
                    type="button"
                    className="btn-action reject-btn"
                    onClick={() => {
                      setRejectingOuting(selectedOutingDetail);
                      setRejectionReason('');
                      setRejectionError('');
                    }}
                  >
                    <X size={14} /> Reject Pass
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedOutingDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
