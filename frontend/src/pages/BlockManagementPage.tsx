import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  BedDouble,
  X,
  Info,
  Check,
} from 'lucide-react';
import {
  managementApiService,
  Block,
  CreateBlockDto,
  UpdateBlockDto,
} from '../services/api';

interface BlockManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const BlockManagementPage: React.FC<BlockManagementPageProps> = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Status Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
  });

  // Delete confirmation modal state
  const [deleteModalBlock, setDeleteModalBlock] = useState<Block | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch authoritative blocks from PostgreSQL
  const fetchBlocks = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await managementApiService.getBlocks({
        search: searchTerm,
        status: statusFilter,
      });
      setBlocks(response.blocks || []);
    } catch (err: any) {
      console.error('Failed to load blocks:', err);
      setError(err.message || 'Unable to load hostel blocks from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, statusFilter]);

  // Initial load & filter effect
  useEffect(() => {
    fetchBlocks(false);
  }, [fetchBlocks]);

  // Real-time SSE synchronization: Automatically refetch on block domain events
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (
        event?.type === 'BLOCK_CREATED' ||
        event?.type === 'BLOCK_UPDATED' ||
        event?.type === 'BLOCK_STATUS_CHANGED' ||
        event?.type === 'BLOCK_DELETED'
      ) {
        fetchBlocks(true);
      }
    });

    return () => unsubscribe();
  }, [fetchBlocks]);

  // Summary Metrics computed directly from authoritative block records
  const summaryMetrics = useMemo(() => {
    const total = blocks.length;
    const active = blocks.filter((b) => b.status === 'ACTIVE').length;
    const inactive = blocks.filter((b) => b.status === 'INACTIVE').length;
    const totalResidents = blocks.reduce((acc, b) => acc + (b.activeResidents || 0), 0);
    const totalRooms = blocks.reduce((acc, b) => acc + (b.totalRooms || 0), 0);

    return { total, active, inactive, totalResidents, totalRooms };
  }, [blocks]);

  // Filtered blocks for client display
  const displayBlocks = useMemo(() => {
    return blocks.filter((b) => {
      const matchesSearch =
        !searchTerm.trim() ||
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [blocks, searchTerm, statusFilter]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBlock(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (block: Block) => {
    setEditingBlock(block);
    setFormData({
      name: block.name,
      code: block.code,
      description: block.description || '',
      status: block.status,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Submit Create / Edit form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    const code = formData.code.trim().toUpperCase();

    if (!name || name.length < 2) {
      setFormError('Block name must be at least 2 characters.');
      return;
    }

    if (!code || code.length < 2) {
      setFormError('Block code must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingBlock) {
        // Update existing block
        const updatePayload: UpdateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        await managementApiService.updateBlock(editingBlock.id, updatePayload);
        showToast(`Block '${name}' (${code}) updated successfully.`);
      } else {
        // Create new block
        const createPayload: CreateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        await managementApiService.createBlock(createPayload);
        showToast(`Block '${name}' (${code}) created successfully.`);
      }

      setIsFormModalOpen(false);
      fetchBlocks(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save block.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Toggle (Active <-> Inactive)
  const handleToggleStatus = async (block: Block) => {
    const nextStatus: 'ACTIVE' | 'INACTIVE' = block.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await managementApiService.updateBlock(block.id, { status: nextStatus });
      showToast(`Block '${block.name}' set to ${nextStatus}.`);
      fetchBlocks(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update block status.', 'error');
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (block: Block) => {
    setDeleteModalBlock(block);
    setDeleteError(null);
  };

  // Execute Safe Block Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModalBlock) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await managementApiService.deleteBlock(deleteModalBlock.id);
      showToast(res.message || `Block '${deleteModalBlock.name}' deleted.`);
      setDeleteModalBlock(null);
      fetchBlocks(true);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete block.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="block-management-view">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className={`block-toast toast-${toastMessage.type}`} role="status">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="toast-icon" />
          ) : (
            <AlertTriangle size={16} className="toast-icon" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
            aria-label="Close message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="block-page-header">
        <div className="block-header-info">
          <div className="block-header-tag">
            <Building size={14} />
            <span>Hostel Infrastructure</span>
          </div>
          <h1 className="block-page-title">Block Management</h1>
          <p className="block-page-desc">
            Configure, organize, and monitor hostel blocks, residential wings, and structural zones.
          </p>
        </div>

        <div className="block-header-actions">
          <button
            type="button"
            onClick={() => fetchBlocks(true)}
            disabled={isRefreshing}
            className="sync-btn"
            title="Refresh blocks from PostgreSQL"
            aria-label="Refresh blocks"
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="sync-btn-label">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary block-add-btn"
            aria-label="Add new hostel block"
          >
            <Plus size={16} />
            <span>+ Add New Block</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="block-kpi-grid" aria-label="Block Operational Summary">
        <div className="block-kpi-card card-navy">
          <div className="block-kpi-header">
            <span className="block-kpi-label">Total Blocks</span>
            <div className="block-kpi-icon-wrap icon-navy">
              <Building size={18} />
            </div>
          </div>
          <div className="block-kpi-val">{summaryMetrics.total}</div>
          <div className="block-kpi-context">Configured structural facilities</div>
        </div>

        <div className="block-kpi-card card-emerald">
          <div className="block-kpi-header">
            <span className="block-kpi-label">Active Blocks</span>
            <div className="block-kpi-icon-wrap icon-emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="block-kpi-val">{summaryMetrics.active}</div>
          <div className="block-kpi-context">Open for residential allocation</div>
        </div>

        <div className="block-kpi-card card-amber">
          <div className="block-kpi-header">
            <span className="block-kpi-label">Inactive / In Renovation</span>
            <div className="block-kpi-icon-wrap icon-amber">
              <XCircle size={18} />
            </div>
          </div>
          <div className="block-kpi-val">{summaryMetrics.inactive}</div>
          <div className="block-kpi-context">Maintenance or offline wings</div>
        </div>

        <div className="block-kpi-card card-indigo">
          <div className="block-kpi-header">
            <span className="block-kpi-label">Assigned Residents</span>
            <div className="block-kpi-icon-wrap icon-indigo">
              <Users size={18} />
            </div>
          </div>
          <div className="block-kpi-val">{summaryMetrics.totalResidents}</div>
          <div className="block-kpi-context">Students allocated across all blocks</div>
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="block-controls-bar">
        <div className="block-search-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="block-search-input"
            placeholder="Search blocks by name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search blocks"
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="block-filter-controls">
          <div className="block-filter-group" role="group" aria-label="Status filter">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            >
              All ({blocks.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`filter-pill ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            >
              Active ({summaryMetrics.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`filter-pill ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
            >
              Inactive ({summaryMetrics.inactive})
            </button>
          </div>

          <div className="block-filter-select-wrap">
            <select
              id="block-status-select-filter"
              className="block-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter blocks by status"
            >
              <option value="ALL">All Blocks ({blocks.length})</option>
              <option value="ACTIVE">Active Only ({summaryMetrics.active})</option>
              <option value="INACTIVE">Inactive Only ({summaryMetrics.inactive})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && blocks.length === 0 && (
        <div className="block-grid" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="block-card skeleton-card" style={{ height: '220px' }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mgmt-error-card" role="alert">
          <AlertTriangle size={36} className="mgmt-error-icon" />
          <h3 className="mgmt-error-title">Unable to Load Blocks</h3>
          <p className="mgmt-error-msg">{error}</p>
          <button
            type="button"
            onClick={() => fetchBlocks(false)}
            className="btn-primary"
            style={{ marginTop: '0.75rem' }}
          >
            <RotateCw size={14} style={{ marginRight: 6 }} />
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && displayBlocks.length === 0 && (
        <div className="block-empty-card">
          <div className="block-empty-icon">
            <Building size={36} />
          </div>
          <h3 className="block-empty-title">
            {searchTerm || statusFilter !== 'ALL' ? 'No Matching Blocks Found' : 'No Blocks Configured Yet'}
          </h3>
          <p className="block-empty-desc">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search keywords or resetting the status filter.'
              : 'Get started by creating your first residential block or wing.'}
          </p>
          {searchTerm || statusFilter !== 'ALL' ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>+ Add New Block</span>
            </button>
          )}
        </div>
      )}

      {/* Block Cards Grid */}
      {!isLoading && displayBlocks.length > 0 && (
        <div className="block-grid" aria-label="Hostel Block Cards">
          {displayBlocks.map((block) => {
            const isActive = block.status === 'ACTIVE';

            return (
              <div key={block.id} className={`block-card ${isActive ? 'status-active' : 'status-inactive'}`}>
                {/* Top header with code & status pill */}
                <div className="block-card-top">
                  <div className="block-badge-group">
                    <span className="block-code-badge">{block.code}</span>
                    <span className={`block-status-pill ${isActive ? 'pill-active' : 'pill-inactive'}`}>
                      {isActive ? <Check size={11} style={{ marginRight: 3 }} /> : <X size={11} style={{ marginRight: 3 }} />}
                      {block.status}
                    </span>
                  </div>

                  <div className="block-resident-badge" title="Active resident students in this block">
                    <Users size={13} />
                    <span>{block.activeResidents ?? 0} residents</span>
                  </div>
                </div>

                {/* Main Content */}
                <div className="block-card-body">
                  <h3 className="block-card-name">{block.name}</h3>
                  <p className="block-card-desc">
                    {block.description || 'No description provided for this residential block.'}
                  </p>
                </div>

                {/* Meta details */}
                <div className="block-card-meta">
                  <div className="meta-col">
                    <span className="meta-label">Total Rooms</span>
                    <span className="meta-val">
                      <BedDouble size={13} style={{ marginRight: 4, opacity: 0.7 }} />
                      {block.totalRooms ?? 0} rooms
                    </span>
                  </div>
                  <div className="meta-col">
                    <span className="meta-label">Configured Date</span>
                    <span className="meta-val">{formatDate(block.createdAt)}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="block-card-footer">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(block)}
                    className={`block-action-btn btn-toggle ${isActive ? 'btn-deactivate' : 'btn-activate'}`}
                    title={isActive ? 'Deactivate block (disallow new room bookings)' : 'Activate block for allocation'}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <div className="block-action-icons">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(block)}
                      className="block-icon-btn btn-edit"
                      title="Edit block information"
                      aria-label={`Edit ${block.name}`}
                    >
                      <Edit2 size={13} />
                      <span className="btn-label-text">Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDelete(block)}
                      className="block-icon-btn btn-delete"
                      title="Delete block (checks dependencies)"
                      aria-label={`Delete ${block.name}`}
                    >
                      <Trash2 size={13} />
                      <span className="btn-label-text">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CREATE / EDIT MODAL
          ========================================================================= */}
      {isFormModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => !isSubmitting && setIsFormModalOpen(false)}>
          <div className="mgmt-modal-dialog block-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mgmt-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-circle">
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="mgmt-modal-title">
                    {editingBlock ? 'Edit Hostel Block' : 'Add New Hostel Block'}
                  </h3>
                  <p className="mgmt-modal-sub">
                    {editingBlock
                      ? 'Update structural and operational metadata for this block.'
                      : 'Configure a new residential facility for room allocation.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="mgmt-modal-body">
                {formError && (
                  <div className="modal-error-alert" role="alert">
                    <AlertTriangle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-field-group">
                  <label htmlFor="block-name" className="form-field-label">
                    Block Name <span className="field-required">*</span>
                  </label>
                  <input
                    id="block-name"
                    type="text"
                    required
                    placeholder="e.g. Girls-Block-B, South-Wing-A"
                    className="form-field-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <span className="form-field-hint">The primary institutional title for this facility.</span>
                </div>

                <div className="form-field-group">
                  <label htmlFor="block-code" className="form-field-label">
                    Block Code <span className="field-required">*</span>
                  </label>
                  <input
                    id="block-code"
                    type="text"
                    required
                    placeholder="e.g. GB-B, SW-A, BH-01"
                    className="form-field-input code-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                  <span className="form-field-hint">A unique uppercase abbreviation used for room tagging.</span>
                </div>

                <div className="form-field-group">
                  <label htmlFor="block-desc" className="form-field-label">
                    Description
                  </label>
                  <textarea
                    id="block-desc"
                    rows={3}
                    placeholder="Specify floor layout, wing details, or residential capacity notes..."
                    className="form-field-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Operational Status</label>
                  <div className="status-radio-group">
                    <label className={`status-radio-option ${formData.status === 'ACTIVE' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="blockStatus"
                        value="ACTIVE"
                        checked={formData.status === 'ACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      />
                      <div className="radio-indicator" />
                      <div className="radio-text">
                        <span className="radio-title">Active</span>
                        <span className="radio-desc">Open for residential assignments</span>
                      </div>
                    </label>

                    <label className={`status-radio-option ${formData.status === 'INACTIVE' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="blockStatus"
                        value="INACTIVE"
                        checked={formData.status === 'INACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'INACTIVE' })}
                      />
                      <div className="radio-indicator" />
                      <div className="radio-text">
                        <span className="radio-title">Inactive</span>
                        <span className="radio-desc">Maintenance or temporarily closed</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mgmt-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RotateCw size={14} className="spin-anim" />
                      <span>{editingBlock ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <span>{editingBlock ? 'Update Block' : 'Create Block'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SAFE DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {deleteModalBlock && (
        <div className="mgmt-modal-backdrop" onClick={() => !isDeleting && setDeleteModalBlock(null)}>
          <div className="mgmt-modal-dialog delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <div className="delete-warning-icon">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="delete-modal-title">Delete Hostel Block?</h3>
                <p className="delete-modal-sub">
                  Target: <strong>{deleteModalBlock.name}</strong> ({deleteModalBlock.code})
                </p>
              </div>
            </div>

            <div className="delete-modal-body">
              {deleteError ? (
                <div className="delete-error-banner" role="alert">
                  <XCircle size={18} className="delete-error-icon" />
                  <div>
                    <h4 className="delete-error-heading">Cannot Delete Block</h4>
                    <p className="delete-error-text">{deleteError}</p>
                  </div>
                </div>
              ) : (
                <div className="delete-warning-text">
                  <p>
                    Are you sure you want to delete this hostel block record? This action will permanently remove
                    the block definition from PostgreSQL.
                  </p>
                  <p className="dependency-safety-note">
                    <Info size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                    The system enforces strict dependency checks. If any students or rooms are associated with this
                    block, deletion will be rejected to protect data integrity.
                  </p>
                </div>
              )}
            </div>

            <div className="delete-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteModalBlock(null)}
                disabled={isDeleting}
              >
                {deleteError ? 'Close' : 'Cancel'}
              </button>

              {!deleteError && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <RotateCw size={14} className="spin-anim" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Block Permanently</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
