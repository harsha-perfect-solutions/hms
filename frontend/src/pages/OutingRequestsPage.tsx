import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Footprints,
  Plus,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Compass,
  ShieldCheck,
  Eye,
  Trash2,
  Info,
  User,
  Copy,
  Check,
} from 'lucide-react';
import {
  apiService,
  OutingRequestsData,
  OutingRequestItem,
  CreateOutingPayload,
} from '../services/api';

export const OutingRequestsPage: React.FC = () => {
  const [data, setData] = useState<OutingRequestsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<OutingRequestItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Notification banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form fields
  const [passType, setPassType] = useState<'LOCAL_OUTING' | 'EMERGENCY' | 'NIGHT_OUT'>('LOCAL_OUTING');
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [outingDate, setOutingDate] = useState<string>('');
  const [exitTime, setExitTime] = useState<string>('');
  const [returnTime, setReturnTime] = useState<string>('');
  const [outDate, setOutDate] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchOutings = useCallback(async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiService.getOutingRequestsData();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load outing requests.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOutings();
  }, [fetchOutings]);

  // Update outDate & returnDate ISO strings whenever outingDate, exitTime, or returnTime changes
  useEffect(() => {
    if (outingDate && exitTime) {
      setOutDate(`${outingDate}T${exitTime}`);
    }
    if (outingDate && returnTime) {
      setReturnDate(`${outingDate}T${returnTime}`);
    }
  }, [outingDate, exitTime, returnTime]);

  // Set default initial dates when opening modal (morning 8:00 AM to night 8:00 PM window)
  const handleOpenCreateModal = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentHour = now.getHours();

    let defaultOutingDate = todayStr;
    let defaultExitTime = '08:00';
    const defaultReturnTime = '20:00';

    // Outings are permitted between morning 8:00 AM (08:00) and night 8:00 PM (20:00)
    if (currentHour >= 20) {
      // Past 8:00 PM, default to tomorrow morning 8:00 AM to 8:00 PM
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      defaultOutingDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      defaultExitTime = '08:00';
    } else if (currentHour >= 8 && currentHour < 19) {
      // During operating hours, default exit to next upcoming hour, returning by 8:00 PM
      defaultExitTime = `${pad(currentHour + 1)}:00`;
    } else {
      defaultExitTime = '08:00';
    }

    setPassType('LOCAL_OUTING');
    setDestination('');
    setPurpose('');
    setOutingDate(defaultOutingDate);
    setExitTime(defaultExitTime);
    setReturnTime(defaultReturnTime);
    setOutDate(`${defaultOutingDate}T${defaultExitTime}`);
    setReturnDate(`${defaultOutingDate}T${defaultReturnTime}`);
    setEmergencyContact('');
    setRemarks('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Helper calculation for live hourly duration preview
  const calculatedDurationHours = useMemo(() => {
    if (!outDate || !returnDate) return 0;
    const start = new Date(outDate).getTime();
    const end = new Date(returnDate).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return 0;
    return Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
  }, [outDate, returnDate]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Frontend validations
    if (!destination.trim() || destination.trim().length < 2) {
      setFormError('Please enter a destination (at least 2 characters).');
      return;
    }

    if (!purpose.trim() || purpose.trim().length < 5) {
      setFormError('Please describe the purpose of your outing (at least 5 characters).');
      return;
    }

    if (!outDate || !returnDate) {
      setFormError('Both exit time and expected return time are required.');
      return;
    }

    const exitTs = new Date(outDate).getTime();
    const retTs = new Date(returnDate).getTime();

    if (isNaN(exitTs) || isNaN(retTs)) {
      setFormError('Please provide valid dates and times.');
      return;
    }

    if (retTs <= exitTs) {
      setFormError('Expected return time must be strictly after the exit time.');
      return;
    }

    // Outing operating hours validation: morning 8:00 AM (08:00) to night 8:00 PM (20:00)
    if (passType === 'LOCAL_OUTING') {
      if (exitTime < '08:00') {
        setFormError('Exit time cannot be earlier than 8:00 AM (morning 8 o\'clock).');
        return;
      }
      if (exitTime > '20:00') {
        setFormError('Exit time cannot be later than 8:00 PM (night 8 o\'clock).');
        return;
      }
      if (returnTime > '20:00') {
        setFormError('Expected return time cannot be later than 8:00 PM (night 8 o\'clock).');
        return;
      }
      if (returnTime < '08:00') {
        setFormError('Expected return time cannot be earlier than 8:00 AM (morning 8 o\'clock).');
        return;
      }
    }

    setIsSubmitting(true);
    setActionSuccess(null);
    setActionError(null);

    const payload: CreateOutingPayload = {
      passType,
      destination: destination.trim(),
      purpose: purpose.trim(),
      outDate: new Date(outDate).toISOString(),
      returnDate: new Date(returnDate).toISOString(),
      emergencyContact: emergencyContact.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };

    try {
      const result = await apiService.createOutingRequest(payload);
      setActionSuccess(result.message || 'Outing request submitted successfully.');
      setIsCreateModalOpen(false);
      await fetchOutings(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit outing request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    setCancellingId(id);
    setActionSuccess(null);
    setActionError(null);

    try {
      const result = await apiService.cancelOutingRequest(id);
      setActionSuccess(result.message || 'Outing request cancelled successfully.');
      setCancelConfirmId(null);
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      await fetchOutings(true);
    } catch (err: any) {
      setActionError(err.message || 'Unable to cancel outing request.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="outing-status-badge badge-pending">
            <Clock size={13} />
            <span>Pending Approval</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="outing-status-badge badge-approved">
            <CheckCircle2 size={13} />
            <span>Approved</span>
          </span>
        );
      case 'OUT':
        return (
          <span className="outing-status-badge badge-out">
            <Footprints size={13} />
            <span>Currently Out</span>
          </span>
        );
      case 'RETURNED':
        return (
          <span className="outing-status-badge badge-returned">
            <ShieldCheck size={13} />
            <span>Returned</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="outing-status-badge badge-rejected">
            <XCircle size={13} />
            <span>Rejected</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="outing-status-badge badge-cancelled">
            <X size={13} />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="outing-status-badge badge-default">
            <span>{status}</span>
          </span>
        );
    }
  };

  const getPassTypeLabel = (passType: string) => {
    switch (passType) {
      case 'LOCAL_OUTING':
        return 'Local Outing';
      case 'EMERGENCY':
        return 'Emergency Pass';
      case 'NIGHT_OUT':
        return 'Night Out';
      default:
        return passType;
    }
  };

  // 1. Error State
  if (error && !loading) {
    return (
      <div className="room-state-container" role="alert">
        <div className="state-card error-state">
          <div className="state-icon-circle error">
            <AlertCircle size={32} />
          </div>
          <h2 className="state-title">Unable to load outing requests</h2>
          <p className="state-desc">{error}</p>
          <button
            type="button"
            onClick={() => fetchOutings()}
            className="btn-retry"
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !data) {
    return (
      <div className="outing-page-content" aria-busy="true">
        <div className="skeleton skeleton-welcome" style={{ height: '90px' }} />
        <div className="summary-cards-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '140px' }} />
          ))}
        </div>
        <div className="skeleton skeleton-feed" style={{ height: '320px' }} />
      </div>
    );
  }

  const summary = data?.summary;
  const requests = data?.requests || [];
  const activePass = requests.find((r) => r.status === 'OUT' || r.status === 'APPROVED');

  return (
    <div className="outing-page-content">
      {/* Toast Notification Banners */}
      {actionSuccess && (
        <div className="feedback-banner success" role="status">
          <div className="feedback-content">
            <CheckCircle2 size={20} className="feedback-icon" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="feedback-banner error" role="alert">
          <div className="feedback-content">
            <AlertCircle size={20} className="feedback-icon" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="mess-page-header">
        <div>
          <h1 className="mess-page-title">Outing Requests</h1>
          <p className="mess-page-subtitle">
            Manage your hostel outing requests, view approval status, and track active passes.
          </p>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className={`refresh-tokens-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => fetchOutings(true)}
            disabled={isRefreshing}
            aria-label="Refresh outing requests"
            title="Refresh outing requests"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn-create-outing"
            onClick={handleOpenCreateModal}
            aria-label="New Outing Request"
          >
            <Plus size={18} />
            <span>New Outing Request</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <section className="summary-cards-grid" aria-label="Outing Statistics">
        {/* Status Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Current Outing Status</span>
            <div className="summary-icon-box" style={{ background: '#EEF2FF', color: '#151B54' }}>
              <Footprints size={20} />
            </div>
          </div>
          <div className="summary-card-main">
            <span className="summary-metric" style={{ fontSize: '1.4rem' }}>
              {summary?.currentStatus || 'In Hostel'}
            </span>
          </div>
          <div className="summary-card-footer">
            <span className="summary-footer-badge">
              {activePass ? 'Active Pass Available' : 'Hostel Resident'}
            </span>
          </div>
        </div>

        {/* Active / Pending Outings */}
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Pending Approvals</span>
            <div className="summary-icon-box" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="summary-card-main">
            <span className="summary-metric">
              {summary?.pendingCount || 0}
            </span>
            <span className="summary-metric-sub">request(s)</span>
          </div>
          <div className="summary-card-footer">
            <span className="summary-footer-badge">
              {summary?.pendingCount ? 'Awaiting Warden Review' : 'No Pending Requests'}
            </span>
          </div>
        </div>

        {/* Monthly Quota */}
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">Monthly Outing Quota</span>
            <div className="summary-icon-box" style={{ background: '#ECFDF5', color: '#047857' }}>
              <Compass size={20} />
            </div>
          </div>
          <div className="summary-card-main">
            <span className="summary-metric">
              {summary?.usedThisMonth || 0} / {summary?.monthlyLimit || 5}
            </span>
            <span className="summary-metric-sub">used</span>
          </div>
          <div className="summary-card-footer">
            <span className="summary-footer-badge">
              {summary?.remainingThisMonth} Remaining this month
            </span>
          </div>
        </div>
      </section>

      {/* Outing Operating Hours Policy Notice */}
      <section className="outing-policy-notice" style={{
        marginBottom: '1.25rem',
        padding: '0.85rem 1.25rem',
        background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
        border: '1px solid #BAE6FD',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: '#0284C7',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0369A1', fontSize: '0.925rem' }}>
              Hostel Outing Timings: Morning 8:00 AM to Night 8:00 PM
            </div>
            <div style={{ color: '#0C4A6E', fontSize: '0.8rem', marginTop: '2px' }}>
              Outings are not limited to 3 hours — you may schedule any duration between morning 8 o'clock (08:00) and night 8 o'clock (20:00).
            </div>
          </div>
        </div>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.775rem',
          fontWeight: 700,
          color: '#0284C7',
          border: '1px solid #BAE6FD',
        }}>
          Gate Curfew: 8:00 PM Sharp
        </div>
      </section>

      {/* Active Pass Notice Banner */}
      {activePass && (
        <section className="active-outing-banner" aria-label="Active Outing Notice">
          <div className="active-banner-left">
            <div className="active-banner-icon">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <span className="active-banner-tag">
                  {activePass.status === 'OUT' ? 'CURRENTLY OUT' : 'OUTING PASS APPROVED'}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  color: '#FFFFFF',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  <User size={13} />
                  <span>{data?.student.name || activePass.student?.name}</span>
                  <span style={{ fontFamily: 'monospace', color: '#BAE6FD' }}>
                    ({data?.student.jntuNo || activePass.student?.jntuNo})
                  </span>
                </span>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#BAE6FD',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600
                }}>
                  {data?.student.blockName || activePass.student?.blockName || 'Hostel'} · Room {data?.student.roomNumber || activePass.student?.roomNumber || '—'}
                </span>
              </div>
              <h2 className="active-banner-title">{activePass.destination}</h2>
              <p className="active-banner-meta">
                Pass Token: <strong className="mono" style={{ color: '#F0F9FF', letterSpacing: '0.5px' }}>{activePass.requestNumber || activePass.id}</strong> ·{' '}
                Exit: {formatDateTime(activePass.outDate)} · Expected Return:{' '}
                {formatDateTime(activePass.returnDate)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-view-active-pass"
            onClick={() => setSelectedRequest(activePass)}
          >
            <Eye size={16} />
            <span>View Digital Pass</span>
          </button>
        </section>
      )}

      {/* Outing Requests List Section */}
      <section className="mess-section" aria-labelledby="outing-list-heading">
        <div className="section-title-group">
          <h2 id="outing-list-heading" className="mess-section-title">
            Outing Request History
          </h2>
          <span className="section-badge">{requests.length} Total Requests</span>
        </div>

        {requests.length === 0 ? (
          <div className="empty-history-card">
            <Compass size={48} className="empty-history-icon" />
            <h3 className="empty-history-title">No Outing Requests</h3>
            <p className="empty-history-desc">
              You haven't submitted any hostel outing requests yet. Create a request to obtain exit authorization from hostel administration.
            </p>
            <button
              type="button"
              className="btn-create-outing"
              style={{ marginTop: '0.75rem' }}
              onClick={handleOpenCreateModal}
            >
              <Plus size={16} />
              <span>Create Outing Request</span>
            </button>
          </div>
        ) : (
          <div className="outing-requests-grid">
            {requests.map((item: OutingRequestItem) => (
              <div key={item.id} className="outing-card">
                <div className="outing-card-header">
                  <div className="outing-card-top-left">
                    <span className="outing-ref-code">
                      {item.requestNumber || 'OUT-RECORD'}
                    </span>
                    <span className="pass-type-badge">
                      {getPassTypeLabel(item.passType)}
                    </span>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                <div className="outing-card-body">
                  {/* Applicant Identity Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.4rem 0.65rem',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    marginBottom: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <User size={14} style={{ color: '#0284C7', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.student?.name || data?.student.name || 'Resident'}
                      </span>
                      <span style={{
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        fontFamily: 'monospace'
                      }}>
                        {item.student?.jntuNo || data?.student.jntuNo || 'ID'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, flexShrink: 0 }}>
                      {item.student?.blockName || data?.student.blockName || 'Hostel'} · Rm {item.student?.roomNumber || data?.student.roomNumber || '—'}
                    </span>
                  </div>

                  <div className="outing-info-row">
                    <MapPin size={16} className="info-icon" />
                    <span className="outing-destination font-semibold">
                      {item.destination || 'Not Specified'}
                    </span>
                  </div>

                  <div className="outing-info-row">
                    <FileText size={16} className="info-icon" />
                    <span className="outing-purpose text-slate-600">
                      {item.purpose}
                    </span>
                  </div>

                  <div className="outing-timing-block">
                    <div className="timing-item">
                      <span className="timing-label">SCHEDULED EXIT</span>
                      <span className="timing-val">{formatDateTime(item.outDate)}</span>
                    </div>
                    <div className="timing-item">
                      <span className="timing-label">EXPECTED RETURN</span>
                      <span className="timing-val">{formatDateTime(item.returnDate)}</span>
                    </div>
                  </div>

                  {item.status === 'REJECTED' && item.rejectionReason && (
                    <div className="rejection-notice-box">
                      <AlertCircle size={14} />
                      <span>Reason: {item.rejectionReason}</span>
                    </div>
                  )}
                </div>

                <div className="outing-card-footer">
                  <span className="submitted-at">
                    Submitted {formatDateTime(item.createdAt)}
                  </span>

                  <div className="outing-actions">
                    <button
                      type="button"
                      className="btn-card-action view"
                      onClick={() => setSelectedRequest(item)}
                      aria-label="View request details"
                    >
                      <Eye size={15} />
                      <span>Details</span>
                    </button>

                    {item.status === 'PENDING' && (
                      <>
                        {cancelConfirmId === item.id ? (
                          <div className="confirm-cancel-group">
                            <span className="confirm-text">Cancel?</span>
                            <button
                              type="button"
                              className="btn-card-action confirm-yes"
                              disabled={cancellingId === item.id}
                              onClick={() => handleCancelRequest(item.id)}
                            >
                              {cancellingId === item.id ? '...' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              className="btn-card-action confirm-no"
                              onClick={() => setCancelConfirmId(null)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-card-action cancel"
                            onClick={() => setCancelConfirmId(item.id)}
                            aria-label="Cancel this outing request"
                          >
                            <Trash2 size={15} />
                            <span>Cancel</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal 1: Create Outing Request */}
      {isCreateModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <div className="modal-container">
            <div className="modal-header">
              <div className="outing-modal-title-group">
                <div className="modal-title-icon-badge">
                  <Footprints size={20} />
                </div>
                <div className="modal-title-text-group">
                  <h2 id="create-modal-title" className="modal-title">
                    New Outing Request
                  </h2>
                  <p className="modal-subtitle">
                    Submit permission for hostel exit and return
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="modal-form-body">
                {formError && (
                  <div className="modal-form-alert" role="alert">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Pass Type & Outing Date */}
                <div className="form-grid-2col">
                  <div className="form-field-group">
                    <label htmlFor="outing-pass-type" className="form-field-label">
                      Pass Type <span className="required">*</span>
                    </label>
                    <select
                      id="outing-pass-type"
                      className="form-select"
                      value={passType}
                      onChange={(e) => setPassType(e.target.value as any)}
                      required
                    >
                      <option value="LOCAL_OUTING">Local Outing (City/Personal)</option>
                      <option value="EMERGENCY">Emergency (Medical/Urgent)</option>
                      <option value="NIGHT_OUT">Night Out (Guardian Stay)</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label htmlFor="outing-date" className="form-field-label">
                      Outing Date <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      id="outing-date"
                      className="form-input"
                      value={outingDate}
                      onChange={(e) => setOutingDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Destination */}
                <div className="form-field-group">
                  <label htmlFor="outing-destination" className="form-field-label">
                    Destination <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="outing-destination"
                    className="form-input"
                    placeholder="e.g. City Central Library, Gandhi Road"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                {/* Row 3: Exit Time & Expected Return Time */}
                <div className="form-grid-2col">
                  <div className="form-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label htmlFor="outing-exit-time" className="form-field-label" style={{ margin: 0 }}>
                        Exit Time <span className="required">*</span>
                      </label>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#2563EB',
                        backgroundColor: '#EFF6FF',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #DBEAFE',
                      }}>
                        From 08:00 AM
                      </span>
                    </div>
                    <input
                      type="time"
                      id="outing-exit-time"
                      className="form-input"
                      value={exitTime}
                      min={passType === 'LOCAL_OUTING' ? '08:00' : undefined}
                      max={passType === 'LOCAL_OUTING' ? '20:00' : undefined}
                      onChange={(e) => setExitTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label htmlFor="outing-return-time" className="form-field-label" style={{ margin: 0 }}>
                        Expected Return <span className="required">*</span>
                      </label>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#0284C7',
                        backgroundColor: '#F0F9FF',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #BAE6FD',
                      }}>
                        By 08:00 PM
                      </span>
                    </div>
                    <input
                      type="time"
                      id="outing-return-time"
                      className="form-input"
                      value={returnTime}
                      min={passType === 'LOCAL_OUTING' ? '08:00' : undefined}
                      max={passType === 'LOCAL_OUTING' ? '20:00' : undefined}
                      onChange={(e) => setReturnTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Unified Timing & Duration Summary Strip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.85rem',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#334155',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                    <Clock size={15} style={{ color: '#2563EB', flexShrink: 0 }} />
                    <span>Operating Hours: <strong style={{ color: '#0F172A' }}>8:00 AM – 8:00 PM</strong></span>
                  </div>
                  {calculatedDurationHours > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Duration:</span>
                      <span style={{
                        backgroundColor: '#EFF6FF',
                        color: '#1D4ED8',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        border: '1px solid #BFDBFE',
                      }}>
                        {calculatedDurationHours} {calculatedDurationHours === 1 ? 'Hour' : 'Hours'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 4: Purpose */}
                <div className="form-field-group">
                  <label htmlFor="outing-purpose" className="form-field-label">
                    Purpose / Reason <span className="required">*</span>
                  </label>
                  <textarea
                    id="outing-purpose"
                    className="form-textarea"
                    rows={2}
                    placeholder="Provide a clear description of your outing (min 5 characters)..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    maxLength={300}
                    required
                  />
                </div>

                {/* Row 5: Emergency Contact & Remarks */}
                <div className="form-grid-2col">
                  <div className="form-field-group">
                    <label htmlFor="outing-contact" className="form-field-label">
                      Emergency Contact (Optional)
                    </label>
                    <input
                      type="tel"
                      id="outing-contact"
                      className="form-input"
                      placeholder="Parent / Guardian number"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      maxLength={20}
                    />
                  </div>

                  <div className="form-field-group">
                    <label htmlFor="outing-remarks" className="form-field-label">
                      Additional Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      id="outing-remarks"
                      className="form-input"
                      placeholder="Note for warden"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-sm" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: View Request Details */}
      {selectedRequest && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-modal-title"
        >
          <div className="modal-container details-modal">
            <div className="modal-header">
              <div className="outing-modal-title-group">
                <div className="modal-title-icon-badge info-badge">
                  <Info size={20} />
                </div>
                <div className="modal-title-text-group">
                  <h2 id="details-modal-title" className="modal-title">
                    Outing Request Details
                  </h2>
                  <p className="modal-subtitle">
                    Authorization status and recorded gate logs
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="details-body">
              {/* Official Digital Gate Pass Badge */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: '#FFFFFF',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.25rem',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} style={{ color: '#38BDF8' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: '#93C5FD', textTransform: 'uppercase' }}>
                      Hostel Outing Authorization Pass
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: selectedRequest.status === 'APPROVED' || selectedRequest.status === 'OUT' ? '#10B981' : '#F59E0B',
                    color: '#FFFFFF'
                  }}>
                    {selectedRequest.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pass Holder / Who Applied
                    </span>
                    <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: '#F8FAFC', marginTop: '0.1rem' }}>
                      {selectedRequest.student?.name || data?.student.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <span style={{
                        backgroundColor: '#0284C7',
                        color: '#FFFFFF',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        fontFamily: 'monospace'
                      }}>
                        {selectedRequest.student?.jntuNo || data?.student.jntuNo}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#CBD5E1' }}>
                        {selectedRequest.student?.blockName || data?.student.blockName || 'Hostel'} · Room {selectedRequest.student?.roomNumber || data?.student.roomNumber || '—'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pass Token Number
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', color: '#38BDF8', letterSpacing: '0.5px' }}>
                        {selectedRequest.requestNumber || selectedRequest.id}
                      </span>
                      {selectedRequest.requestNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopyToken(selectedRequest.requestNumber!)}
                          title="Copy token to clipboard"
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: copiedToken === selectedRequest.requestNumber ? '#34D399' : '#94A3B8',
                            borderRadius: '4px',
                            padding: '0.2rem 0.4rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.68rem'
                          }}
                        >
                          {copiedToken === selectedRequest.requestNumber ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedToken === selectedRequest.requestNumber ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                      Type: {getPassTypeLabel(selectedRequest.passType)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Header */}
              <div className="details-status-bar">
                <div>
                  <span className="details-ref">
                    {selectedRequest.requestNumber || selectedRequest.id}
                  </span>
                  <div className="text-sm text-slate-500 mt-1">
                    {getPassTypeLabel(selectedRequest.passType)}
                  </div>
                </div>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>

              {/* Destination & Purpose */}
              <div className="details-section-box">
                <div className="detail-field">
                  <span className="detail-field-label">DESTINATION</span>
                  <span className="detail-field-val font-semibold text-slate-900">
                    {selectedRequest.destination || 'Not specified'}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">PURPOSE</span>
                  <span className="detail-field-val text-slate-700">
                    {selectedRequest.purpose}
                  </span>
                </div>
              </div>

              {/* Timings */}
              <div className="details-grid-2col">
                <div className="detail-field">
                  <span className="detail-field-label">SCHEDULED EXIT</span>
                  <span className="detail-field-val">
                    {formatDateTime(selectedRequest.outDate)}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">EXPECTED RETURN</span>
                  <span className="detail-field-val">
                    {formatDateTime(selectedRequest.returnDate)}
                  </span>
                </div>
              </div>

              {/* Actual Gate Timings if recorded */}
              {(selectedRequest.actualExitTime || selectedRequest.actualReturnTime) && (
                <div className="details-grid-2col">
                  <div className="detail-field">
                    <span className="detail-field-label">ACTUAL GATE EXIT</span>
                    <span className="detail-field-val">
                      {formatDateTime(selectedRequest.actualExitTime)}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-field-label">ACTUAL GATE RETURN</span>
                    <span className="detail-field-val">
                      {formatDateTime(selectedRequest.actualReturnTime)}
                    </span>
                  </div>
                </div>
              )}

              {/* Emergency Contact & Remarks */}
              <div className="details-grid-2col">
                <div className="detail-field">
                  <span className="detail-field-label">EMERGENCY CONTACT</span>
                  <span className="detail-field-val">
                    {selectedRequest.emergencyContact || 'None provided'}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">SUBMISSION TIME</span>
                  <span className="detail-field-val">
                    {formatDateTime(selectedRequest.createdAt)}
                  </span>
                </div>
              </div>

              {/* Rejection notice */}
              {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
                <div className="rejection-notice-box">
                  <AlertCircle size={16} />
                  <div>
                    <strong className="block">Rejection Reason:</strong>
                    <span>{selectedRequest.rejectionReason}</span>
                  </div>
                </div>
              )}

              {/* Student Location */}
              <div className="detail-field student-meta-chip">
                <span className="detail-field-label">APPLICANT</span>
                <span className="detail-field-val font-semibold">
                  {data?.student.name} ({data?.student.jntuNo}) ·{' '}
                  {data?.student.blockName || 'Hostel'} - {data?.student.roomNumber || 'Room'}
                </span>
              </div>
            </div>

            <div className="modal-actions-footer">
              {selectedRequest.status === 'PENDING' && (
                <button
                  type="button"
                  className="btn-modal-cancel text-red-600"
                  disabled={cancellingId === selectedRequest.id}
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                >
                  <Trash2 size={15} />
                  <span>Cancel Request</span>
                </button>
              )}
              <button
                type="button"
                className="btn-modal-submit"
                onClick={() => setSelectedRequest(null)}
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

export default OutingRequestsPage;
