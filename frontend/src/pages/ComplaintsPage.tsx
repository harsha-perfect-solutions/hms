import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  MapPin,
  LifeBuoy,
  UploadCloud,
  MessageSquare,
  Send,
  Eye,
  Trash2,
  Zap,
  Droplets,
  Home,
  Sparkles,
  Armchair,
  Wifi,
  Utensils,
  Shield,
  HelpCircle,
  Paperclip,
} from 'lucide-react';
import {
  apiService,
  ComplaintsData,
  ComplaintItem,
  CreateComplaintPayload,
} from '../services/api';

export const ComplaintsPage: React.FC = () => {
  const [data, setData] = useState<ComplaintsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Tabs
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // Notification banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);

  // Create Complaint Form Fields
  const [category, setCategory] = useState<string>('ROOM');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [location, setLocation] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Follow-up Note in Details Modal
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Detail Modal inline attachment upload
  const [isUploadingDetailAttachment, setIsUploadingDetailAttachment] = useState<boolean>(false);
  const [detailAttachmentError, setDetailAttachmentError] = useState<string | null>(null);

  const fetchComplaints = useCallback(async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiService.getComplaintsData();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load complaints.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Phase 2 & 3: Dedicated Authoritative Complaint Detail Fetching
   */
  const fetchComplaintDetail = useCallback(async (id: string, isSilent = false) => {
    if (!isSilent) setIsDetailLoading(true);
    setDetailError(null);

    try {
      const res = await apiService.getComplaintDetail(id);
      setSelectedComplaint(res.complaint);
    } catch (err: any) {
      setDetailError(err.message || 'Unable to load complaint details.');
    } finally {
      if (!isSilent) setIsDetailLoading(false);
    }
  }, []);

  const handleOpenDetails = (id: string) => {
    setSelectedComplaintId(id);
    setSelectedComplaint(null);
    fetchComplaintDetail(id);
  };

  // Phase 10 & 11: Real-time SSE Connection & Auto-resync
  useEffect(() => {
    fetchComplaints();

    const unsubscribe = apiService.subscribeToComplaintEvents((event) => {
      // Authoritatively refetch list
      fetchComplaints(true);

      // If details modal is open for this complaint, authoritatively refetch details
      if (selectedComplaintId && selectedComplaintId === event.complaintId) {
        fetchComplaintDetail(event.complaintId, true);
      }

      // Subtle indicator
      let msg = 'Complaints updated in real time.';
      if (event.type === 'COMPLAINT_CREATED') msg = 'New complaint registered.';
      else if (event.type === 'COMPLAINT_COMMENT_ADDED') msg = 'New follow-up note added.';
      else if (event.type === 'COMPLAINT_CANCELLED') msg = 'Complaint marked as cancelled.';
      else if (event.type === 'COMPLAINT_ATTACHMENT_ADDED') msg = 'New attachment added.';

      setRealtimeNotification(msg);
      const timer = setTimeout(() => setRealtimeNotification(null), 3500);
      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchComplaints, fetchComplaintDetail, selectedComplaintId]);

  // Open Create Modal with sensible defaults
  const handleOpenCreateModal = () => {
    const defaultLoc =
      data?.student.blockName && data?.student.roomNumber
        ? `${data.student.blockName} - ${data.student.roomNumber}`
        : '';

    setCategory('ROOM');
    setPriority('MEDIUM');
    setLocation(defaultLoc);
    setTitle('');
    setDescription('');
    setAttachedFile(null);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file size (<= 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Attachment must not exceed 5MB in size.');
        return;
      }
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setFormError('Only JPG, PNG or WebP images are allowed.');
        return;
      }
      setFormError(null);
      setAttachedFile(file);
    }
  };

  /**
   * Phase 6: Form Submission with Real Attachment Upload
   */
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validations
    if (!title.trim() || title.trim().length < 3) {
      setFormError('Please enter a descriptive subject (at least 3 characters).');
      return;
    }
    if (title.trim().length > 120) {
      setFormError('Subject must not exceed 120 characters.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setFormError('Please provide a detailed description (at least 10 characters).');
      return;
    }
    if (description.trim().length > 1000) {
      setFormError('Description must not exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateComplaintPayload = {
        category,
        priority,
        location: location.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
      };

      const result = await apiService.createComplaint(payload);

      // Real attachment upload if student attached a file
      if (attachedFile && result.complaint?.id) {
        try {
          await apiService.uploadComplaintAttachment(result.complaint.id, attachedFile);
          setActionSuccess('Complaint and photo attachment submitted successfully.');
        } catch (uploadErr: any) {
          setActionSuccess(`Complaint submitted, but photo upload encountered an issue: ${uploadErr.message}`);
        }
      } else {
        setActionSuccess(result.message || 'Complaint submitted successfully.');
      }

      setActionError(null);
      setIsCreateModalOpen(false);

      // Refresh authoritative backend data
      await fetchComplaints(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit complaint. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelComplaint = async (id: string) => {
    setCancellingId(id);
    setActionSuccess(null);
    setActionError(null);

    try {
      const result = await apiService.cancelComplaint(id);
      setActionSuccess(result.message || 'Complaint cancelled successfully.');
      setCancelConfirmId(null);
      if (selectedComplaint?.id === id) {
        // Refresh authoritative detail
        fetchComplaintDetail(id, true);
      }
      await fetchComplaints(true);
    } catch (err: any) {
      setActionError(err.message || 'Unable to cancel complaint.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!newNoteText.trim() || newNoteText.trim().length < 2) {
      setNoteError('Please enter at least 2 characters for your note.');
      return;
    }

    setIsAddingNote(true);
    setNoteError(null);

    try {
      const result = await apiService.addComplaintComment(selectedComplaint.id, newNoteText.trim());
      setNewNoteText('');
      // Update selected complaint state locally and refetch
      setSelectedComplaint(result.complaint);
      setActionSuccess('Follow-up note added successfully.');
      await fetchComplaints(true);
    } catch (err: any) {
      setNoteError(err.message || 'Unable to add note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDetailAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedComplaint || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      setDetailAttachmentError('File size exceeds the 5MB limit.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setDetailAttachmentError('Only JPG, PNG or WebP images are permitted.');
      return;
    }

    setDetailAttachmentError(null);
    setIsUploadingDetailAttachment(true);

    try {
      await apiService.uploadComplaintAttachment(selectedComplaint.id, file);
      setActionSuccess('Photo attached successfully.');
      // Refetch authoritative details
      await fetchComplaintDetail(selectedComplaint.id, true);
      await fetchComplaints(true);
    } catch (err: any) {
      setDetailAttachmentError(err.message || 'Failed to upload attachment.');
    } finally {
      setIsUploadingDetailAttachment(false);
      e.target.value = '';
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

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'ELECTRICAL':
        return { label: 'Electrical', icon: Zap, color: 'cat-electrical' };
      case 'PLUMBING':
        return { label: 'Plumbing', icon: Droplets, color: 'cat-plumbing' };
      case 'ROOM':
        return { label: 'Room Maintenance', icon: Home, color: 'cat-room' };
      case 'CLEANING':
        return { label: 'Cleaning', icon: Sparkles, color: 'cat-cleaning' };
      case 'FURNITURE':
        return { label: 'Furniture', icon: Armchair, color: 'cat-furniture' };
      case 'WIFI':
        return { label: 'Wi-Fi / Internet', icon: Wifi, color: 'cat-wifi' };
      case 'MESS':
        return { label: 'Mess / Food', icon: Utensils, color: 'cat-mess' };
      case 'SECURITY':
        return { label: 'Security', icon: Shield, color: 'cat-security' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: HelpCircle, color: 'cat-other' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="complaint-status-badge badge-open">
            <Clock size={13} />
            <span>Open</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="complaint-status-badge badge-progress">
            <RefreshCw size={13} className="spin-slow" />
            <span>In Progress</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="complaint-status-badge badge-resolved">
            <CheckCircle2 size={13} />
            <span>Resolved</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="complaint-status-badge badge-closed">
            <CheckCircle2 size={13} />
            <span>Closed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="complaint-status-badge badge-cancelled">
            <XCircle size={13} />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="complaint-status-badge badge-default">
            <span>{status}</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="priority-badge pri-urgent">Urgent</span>;
      case 'HIGH':
        return <span className="priority-badge pri-high">High</span>;
      case 'MEDIUM':
        return <span className="priority-badge pri-medium">Medium</span>;
      case 'LOW':
        return <span className="priority-badge pri-low">Low</span>;
      default:
        return <span className="priority-badge pri-medium">{p}</span>;
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
          <h2>Unable to Load Complaints</h2>
          <p>{error}</p>
          <button
            type="button"
            className="retry-btn"
            onClick={() => fetchComplaints()}
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
      <div className="complaints-page-container">
        <div className="page-intro-header">
          <div>
            <h1 className="page-main-heading">Complaints</h1>
            <p className="page-sub-heading">Lodge and track maintenance issues and complaints</p>
          </div>
        </div>
        <div className="complaint-summary-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stat-card skeleton-card">
              <div className="skeleton-line shimmer" style={{ width: '40%', height: '14px', marginBottom: '12px' }} />
              <div className="skeleton-line shimmer" style={{ width: '25%', height: '32px', marginBottom: '8px' }} />
              <div className="skeleton-line shimmer" style={{ width: '60%', height: '12px' }} />
            </div>
          ))}
        </div>
        <div className="empty-panel skeleton-panel shimmer" style={{ minHeight: '300px', marginTop: '24px' }} />
      </div>
    );
  }

  const allComplaints = data?.complaints || [];

  // Filter complaints
  const filteredComplaints = allComplaints.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="complaints-page-container">
      {/* Toast Notifications */}
      {actionSuccess && (
        <div className="action-toast toast-success" role="alert">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="action-toast toast-error" role="alert">
          <AlertCircle size={18} />
          <span>{actionError}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {realtimeNotification && (
        <div className="action-toast toast-success" role="status" style={{ borderLeft: '4px solid #10B981' }}>
          <RefreshCw size={16} className="spin-slow" />
          <span>{realtimeNotification}</span>
        </div>
      )}

      {/* Page Header matching visual reference media_1788852698073.jpg */}
      <div className="page-intro-header">
        <div>
          <h1 className="page-main-heading">Complaints</h1>
          <p className="page-sub-heading">Lodge and track maintenance issues and complaints</p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="refresh-secondary-btn"
            onClick={() => fetchComplaints(true)}
            disabled={isRefreshing}
            title="Refresh complaints"
            aria-label="Refresh complaints"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="hide-on-mobile">Refresh</span>
          </button>

          <button
            type="button"
            className="primary-action-btn"
            onClick={handleOpenCreateModal}
          >
            <Plus size={18} />
            <span>New Complaint</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards matching reference media_1788852698073.jpg */}
      <div className="complaint-summary-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Complaints</div>
          <div className="stat-card-value">{data?.summary.total ?? 0}</div>
          <div className="stat-card-subtext">All time lodged</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">In Progress</div>
          <div className="stat-card-value text-amber">{data?.summary.inProgress ?? 0}</div>
          <div className="stat-card-subtext">Under review / action</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Resolved</div>
          <div className="stat-card-value text-emerald">{data?.summary.resolved ?? 0}</div>
          <div className="stat-card-subtext">Completed issues</div>
        </div>
      </div>

      {/* Filter and Tab Section */}
      <div className="complaint-controls-bar">
        {/* Status Tabs */}
        <div className="complaint-status-tabs" role="tablist">
          {[
            { key: 'ALL', label: 'All', count: allComplaints.length },
            { key: 'OPEN', label: 'Open', count: data?.summary.open ?? 0 },
            { key: 'IN_PROGRESS', label: 'In Progress', count: data?.summary.inProgress ?? 0 },
            { key: 'RESOLVED', label: 'Resolved', count: data?.summary.resolved ?? 0 },
            { key: 'CANCELLED', label: 'Cancelled', count: data?.summary.cancelled ?? 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.key}
              className={`complaint-tab-btn ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="tab-pill-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="complaint-category-filter">
          <label htmlFor="catFilter" className="sr-only">Filter by Category</label>
          <select
            id="catFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Categories</option>
            <option value="ROOM">Room Maintenance</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="PLUMBING">Plumbing</option>
            <option value="CLEANING">Cleaning</option>
            <option value="FURNITURE">Furniture</option>
            <option value="WIFI">Wi-Fi / Internet</option>
            <option value="MESS">Mess / Food</option>
            <option value="SECURITY">Security</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Complaint List or Empty State */}
      {allComplaints.length === 0 ? (
        /* Empty State matching media_1788852698073.jpg */
        <div className="complaint-empty-card">
          <div className="empty-icon-wrapper">
            <LifeBuoy size={36} className="empty-lifebuoy-icon" />
          </div>
          <h3 className="empty-title">No complaints found</h3>
          <p className="empty-desc">You haven't raised any complaints yet.</p>
          <button
            type="button"
            className="empty-raise-btn"
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} />
            <span>Raise Complaint</span>
          </button>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="complaint-empty-card">
          <div className="empty-icon-wrapper">
            <AlertCircle size={36} className="empty-lifebuoy-icon" />
          </div>
          <h3 className="empty-title">No matching complaints</h3>
          <p className="empty-desc">No complaints match your selected filters.</p>
          <button
            type="button"
            className="empty-raise-btn secondary"
            onClick={() => {
              setStatusFilter('ALL');
              setCategoryFilter('ALL');
            }}
          >
            <RefreshCw size={16} />
            <span>Reset Filters</span>
          </button>
        </div>
      ) : (
        <div className="complaints-grid-container">
          {filteredComplaints.map((item) => {
            const catMeta = getCategoryMeta(item.category);
            const CatIcon = catMeta.icon;
            const commentsList = item.commentsList || [];

            return (
              <div key={item.id} className="complaint-card">
                {/* Card Header */}
                <div className="complaint-card-top">
                  <div className="complaint-tag-group">
                    <span className={`complaint-category-pill ${catMeta.color}`}>
                      <CatIcon size={13} />
                      <span>{catMeta.label}</span>
                    </span>
                    <span className="complaint-ticket-no">{item.ticketNumber}</span>
                  </div>
                  <div className="complaint-top-right">
                    {getPriorityBadge(item.priority)}
                    {getStatusBadge(item.status)}
                  </div>
                </div>

                {/* Card Title & Description */}
                <div className="complaint-card-body">
                  <h3 className="complaint-subject">{item.title}</h3>
                  <p className="complaint-snippet">{item.description}</p>
                </div>

                {/* Resolution banner if resolved */}
                {item.status === 'RESOLVED' && item.resolutionNotes && (
                  <div className="complaint-resolved-snippet">
                    <CheckCircle2 size={15} className="resolved-check" />
                    <div>
                      <strong>Resolution:</strong> {item.resolutionNotes}
                    </div>
                  </div>
                )}

                {/* Card Meta Footer */}
                <div className="complaint-card-meta">
                  <div className="meta-item-inline" title="Location">
                    <MapPin size={13} />
                    <span>{item.location || 'Hostel Room'}</span>
                  </div>
                  <div className="meta-item-inline" title="Created date">
                    <Clock size={13} />
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="meta-item-inline" title="Attachments">
                      <Paperclip size={13} />
                      <span>{item.attachments.length} file{item.attachments.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {commentsList.length > 0 && (
                    <div className="meta-item-inline" title="Follow-up notes">
                      <MessageSquare size={13} />
                      <span>{commentsList.length} note{commentsList.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="complaint-card-actions">
                  <button
                    type="button"
                    className="card-btn-details"
                    onClick={() => handleOpenDetails(item.id)}
                  >
                    <Eye size={15} />
                    <span>View Details</span>
                  </button>

                  {item.status === 'OPEN' && (
                    <>
                      {cancelConfirmId === item.id ? (
                        <div className="cancel-confirm-group">
                          <span className="cancel-prompt-text">Confirm cancel?</span>
                          <button
                            type="button"
                            className="confirm-yes-btn"
                            onClick={() => handleCancelComplaint(item.id)}
                            disabled={cancellingId === item.id}
                          >
                            {cancellingId === item.id ? 'Cancelling...' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            className="confirm-no-btn"
                            onClick={() => setCancelConfirmId(null)}
                            disabled={cancellingId === item.id}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="card-btn-cancel"
                          onClick={() => setCancelConfirmId(item.id)}
                        >
                          <Trash2 size={14} />
                          <span>Cancel</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RAISE NEW COMPLAINT MODAL — Matches media_1788852857206.jpg */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="modal-container complaint-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h2 id="modal-title" className="modal-title">Raise New Complaint</h2>
                <p className="modal-subtitle">
                  Submit an issue for maintenance or administration to resolve
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div className="form-error-banner" role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Complaint Form */}
            <form onSubmit={handleCreateSubmit} className="complaint-form">
              <div className="form-grid-2col">
                {/* Complaint Type * */}
                <div className="form-field">
                  <label htmlFor="complaintType" className="field-label">
                    Complaint Type <span className="req-star">*</span>
                  </label>
                  <select
                    id="complaintType"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="field-input"
                    disabled={isSubmitting}
                  >
                    <option value="ROOM">Room / Maintenance</option>
                    <option value="ELECTRICAL">Electrical / Power</option>
                    <option value="PLUMBING">Plumbing / Water</option>
                    <option value="CLEANING">Cleaning / Housekeeping</option>
                    <option value="FURNITURE">Furniture / Fixtures</option>
                    <option value="WIFI">Wi-Fi / Internet</option>
                    <option value="MESS">Mess / Food</option>
                    <option value="SECURITY">Security / Safety</option>
                    <option value="OTHER">Other Concern</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="form-field">
                  <label htmlFor="complaintPriority" className="field-label">
                    Priority
                  </label>
                  <select
                    id="complaintPriority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="field-input"
                    disabled={isSubmitting}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="form-field">
                <label htmlFor="complaintLocation" className="field-label">
                  Location
                </label>
                <input
                  id="complaintLocation"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Girls-Block-B - 119, Common Study Hall"
                  className="field-input"
                  disabled={isSubmitting}
                  maxLength={80}
                />
              </div>

              {/* Subject / Title * */}
              <div className="form-field">
                <label htmlFor="complaintTitle" className="field-label">
                  Subject / Title <span className="req-star">*</span>
                </label>
                <input
                  id="complaintTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue (e.g. Ceiling fan speed regulator broken)"
                  required
                  className="field-input"
                  disabled={isSubmitting}
                  maxLength={120}
                />
              </div>

              {/* Description * */}
              <div className="form-field">
                <label htmlFor="complaintDesc" className="field-label">
                  Description <span className="req-star">*</span>
                </label>
                <textarea
                  id="complaintDesc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail, including specific locations or equipment..."
                  required
                  className="field-textarea"
                  disabled={isSubmitting}
                  maxLength={1000}
                />
                <div className="field-hint">
                  {description.length} / 1000 characters (minimum 10 characters)
                </div>
              </div>

              {/* Drag & Drop Visual Zone matching media_1788852857206.jpg */}
              <div className="form-field">
                <label className="field-label">Attach Photos (optional)</label>
                <div className="file-dropzone">
                  <input
                    type="file"
                    id="fileUploadInput"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="file-hidden-input"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="fileUploadInput" className="file-dropzone-label">
                    <UploadCloud size={32} className="dropzone-icon" />
                    <div className="dropzone-text">
                      <span className="dropzone-highlight">Drag & drop photos here</span>, or browse files
                    </div>
                    <div className="dropzone-subtext">Supports JPG, PNG up to 5MB</div>
                  </label>
                  {attachedFile && (
                    <div className="attached-file-pill">
                      <Paperclip size={14} />
                      <span className="attached-file-name">{attachedFile.name}</span>
                      <span className="attached-file-size">
                        ({(attachedFile.size / 1024).toFixed(0)} KB)
                      </span>
                      <button
                        type="button"
                        className="attached-remove-btn"
                        onClick={() => setAttachedFile(null)}
                        aria-label="Remove attached file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-action-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit-modal"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spin-anim" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Complaint</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLAINT DETAILS MODAL — Authoritative Detail API, Attachments, Timeline */}
      {/* ========================================================================= */}
      {selectedComplaintId && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSelectedComplaintId(null);
            setSelectedComplaint(null);
            setDetailError(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-modal-title"
        >
          <div
            className="modal-container complaint-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="details-header-title">
                {isDetailLoading ? (
                  <div className="skeleton-line shimmer" style={{ width: '120px', height: '18px', marginBottom: '6px' }} />
                ) : selectedComplaint ? (
                  <div className="details-ticket-row">
                    <span className="details-ticket-number">{selectedComplaint.ticketNumber}</span>
                    {getStatusBadge(selectedComplaint.status)}
                    {getPriorityBadge(selectedComplaint.priority)}
                  </div>
                ) : null}
                <h2 id="details-modal-title" className="details-title-text">
                  {isDetailLoading ? 'Loading Complaint Details...' : selectedComplaint ? selectedComplaint.title : 'Complaint Details'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setSelectedComplaintId(null);
                  setSelectedComplaint(null);
                  setDetailError(null);
                }}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {isDetailLoading ? (
              <div className="details-modal-scrollable" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="skeleton-line shimmer" style={{ width: '100%', height: '80px', borderRadius: '8px' }} />
                  <div className="skeleton-line shimmer" style={{ width: '100%', height: '100px', borderRadius: '8px' }} />
                  <div className="skeleton-line shimmer" style={{ width: '100%', height: '120px', borderRadius: '8px' }} />
                </div>
              </div>
            ) : detailError ? (
              <div className="details-modal-scrollable" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="state-icon-circle error" style={{ margin: '0 auto 1rem' }}>
                  <AlertCircle size={28} />
                </div>
                <h3 style={{ color: '#991B1B', fontWeight: 700, marginBottom: '0.5rem' }}>Unable to View Details</h3>
                <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{detailError}</p>
                <button
                  type="button"
                  className="retry-btn"
                  onClick={() => fetchComplaintDetail(selectedComplaintId)}
                >
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </button>
              </div>
            ) : selectedComplaint ? (
              <div className="details-modal-scrollable">
                {/* Meta information strip */}
                <div className="details-info-strip">
                  <div className="strip-item">
                    <span className="strip-label">Category:</span>
                    <span className="strip-value">{getCategoryMeta(selectedComplaint.category).label}</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-label">Location:</span>
                    <span className="strip-value">{selectedComplaint.location || 'N/A'}</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-label">Lodged On:</span>
                    <span className="strip-value">{formatDateTime(selectedComplaint.createdAt)}</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-label">Last Updated:</span>
                    <span className="strip-value">{formatDateTime(selectedComplaint.updatedAt)}</span>
                  </div>
                </div>

                {/* Full Description */}
                <div className="details-section">
                  <h4 className="details-section-heading">Detailed Description</h4>
                  <div className="details-description-box">{selectedComplaint.description}</div>
                </div>

                {/* Attachments Section (Phase 5 & 6) */}
                <div className="details-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 className="details-section-heading">
                      Attachments ({selectedComplaint.attachments?.length || 0})
                    </h4>
                    {(selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'IN_PROGRESS') && (
                      <div>
                        <label
                          htmlFor="detailAttachUpload"
                          className="btn-add-note"
                          style={{ cursor: isUploadingDetailAttachment ? 'wait' : 'pointer', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          <Paperclip size={13} />
                          <span>{isUploadingDetailAttachment ? 'Uploading...' : 'Add Photo'}</span>
                        </label>
                        <input
                          id="detailAttachUpload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          disabled={isUploadingDetailAttachment}
                          onChange={handleDetailAttachmentUpload}
                        />
                      </div>
                    )}
                  </div>

                  {detailAttachmentError && (
                    <div className="note-error-inline" role="alert" style={{ marginTop: '0.25rem' }}>
                      <AlertCircle size={14} />
                      <span>{detailAttachmentError}</span>
                    </div>
                  )}

                  {!selectedComplaint.attachments || selectedComplaint.attachments.length === 0 ? (
                    <p className="empty-notes-hint">No file attachments uploaded for this complaint.</p>
                  ) : (
                    <div className="complaint-attachments-grid">
                      {selectedComplaint.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-card-link"
                          title={`View ${att.fileName}`}
                        >
                          <Paperclip size={16} className="att-icon" />
                          <div className="att-info">
                            <span className="att-name">{att.fileName}</span>
                            <span className="att-size">({(att.fileSize / 1024).toFixed(0)} KB)</span>
                          </div>
                          <span className="att-view-badge">View</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolution Panel if Resolved */}
                {selectedComplaint.status === 'RESOLVED' && (
                  <div className="resolution-card-panel">
                    <div className="resolution-panel-header">
                      <CheckCircle2 size={20} className="res-icon" />
                      <div>
                        <h4 className="res-heading">Complaint Resolved</h4>
                        <p className="res-time">Completed on {formatDateTime(selectedComplaint.resolvedAt)}</p>
                      </div>
                    </div>
                    {selectedComplaint.resolutionNotes && (
                      <div className="res-notes-content">
                        <strong>Resolution Notes:</strong> {selectedComplaint.resolutionNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div className="details-section">
                  <h4 className="details-section-heading">Status Progress</h4>
                  <div className="timeline-tracker">
                    {/* Step 1: Lodged */}
                    <div className="timeline-step completed">
                      <div className="timeline-circle">
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-label">Complaint Submitted</div>
                        <div className="timeline-date">{formatDateTime(selectedComplaint.createdAt)}</div>
                        <div className="timeline-sub">Ticket generated and routed to maintenance team</div>
                      </div>
                    </div>

                    {/* Step 2: In Progress / In Review */}
                    {selectedComplaint.status !== 'CANCELLED' ? (
                      <div
                        className={`timeline-step ${
                          selectedComplaint.status === 'IN_PROGRESS' || selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED'
                            ? 'completed'
                            : 'current'
                        }`}
                      >
                        <div className="timeline-circle">
                          {selectedComplaint.status === 'IN_PROGRESS' ? (
                            <RefreshCw size={13} className="spin-slow" />
                          ) : selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED' ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Clock size={13} />
                          )}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-label">Under Investigation</div>
                          <div className="timeline-sub">
                            {selectedComplaint.status === 'IN_PROGRESS'
                              ? 'Maintenance technician assigned and inspecting issue'
                              : selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED'
                              ? 'Work inspected and completed'
                              : 'Awaiting technician assignment'}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Step 3: Resolved or Cancelled */}
                    {selectedComplaint.status === 'CANCELLED' ? (
                      <div className="timeline-step step-cancelled">
                        <div className="timeline-circle">
                          <XCircle size={14} />
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-label">Complaint Cancelled</div>
                          <div className="timeline-date">{formatDateTime(selectedComplaint.updatedAt)}</div>
                          <div className="timeline-sub">Withdrawn by student</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`timeline-step ${
                          selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED'
                            ? 'completed'
                            : 'pending'
                        }`}
                      >
                        <div className="timeline-circle">
                          <CheckCircle2 size={14} />
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-label">Resolution & Sign-off</div>
                          <div className="timeline-sub">
                            {selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED'
                              ? `Resolved on ${formatDateTime(selectedComplaint.resolvedAt)}`
                              : 'Issue repaired and verified'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Follow-up Notes / Comments Section */}
                <div className="details-section">
                  <h4 className="details-section-heading">
                    Follow-up Notes & Updates ({selectedComplaint.commentsList?.length || 0})
                  </h4>

                  {/* List of existing notes */}
                  {(!selectedComplaint.commentsList || selectedComplaint.commentsList.length === 0) ? (
                    <p className="empty-notes-hint">No follow-up notes added yet.</p>
                  ) : (
                    <div className="comments-stream">
                      {selectedComplaint.commentsList.map((c) => (
                        <div key={c.id} className="comment-bubble">
                          <div className="comment-header">
                            <span className="comment-author">{c.author}</span>
                            <span className="comment-time">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="comment-body">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add note form if ticket is active */}
                  {(selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'IN_PROGRESS') ? (
                    <form onSubmit={handleAddNote} className="add-note-form">
                      {noteError && (
                        <div className="note-error-inline" role="alert">
                          <AlertCircle size={14} />
                          <span>{noteError}</span>
                        </div>
                      )}
                      <div className="note-input-row">
                        <input
                          type="text"
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Add a follow-up note or technician update..."
                          className="note-text-input"
                          disabled={isAddingNote}
                          maxLength={500}
                        />
                        <button
                          type="submit"
                          className="btn-add-note"
                          disabled={isAddingNote || !newNoteText.trim()}
                        >
                          {isAddingNote ? (
                            <RefreshCw size={14} className="spin-anim" />
                          ) : (
                            <Send size={14} />
                          )}
                          <span>Add Note</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="ticket-closed-note-hint">
                      This ticket is {selectedComplaint.status.toLowerCase()}. Additional notes cannot be added.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Modal Footer Actions */}
            <div className="modal-action-footer">
              {selectedComplaint && selectedComplaint.status === 'OPEN' && (
                <button
                  type="button"
                  className="card-btn-cancel"
                  onClick={() => handleCancelComplaint(selectedComplaint.id)}
                  disabled={cancellingId === selectedComplaint.id}
                >
                  <Trash2 size={14} />
                  <span>{cancellingId === selectedComplaint.id ? 'Cancelling...' : 'Cancel Complaint'}</span>
                </button>
              )}
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => {
                  setSelectedComplaintId(null);
                  setSelectedComplaint(null);
                  setDetailError(null);
                }}
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

