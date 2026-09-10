import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UtensilsCrossed,
  Search,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Building,
  User,
  Eye,
  Check,
  Ban,
  Radio,
  History,
  TrendingUp,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  managementApiService,
  ManagementMessOverview,
  ManagementMessToken,
  ManagementMessTokenDetail,
  Block,
} from '../services/api';

interface MessManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const MessManagementPage: React.FC<MessManagementPageProps> = () => {
  // Date selection (defaults to today's local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Overview & Statistics State
  const [overview, setOverview] = useState<ManagementMessOverview | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState<boolean>(true);

  // Tokens Table State
  const [tokens, setTokens] = useState<ManagementMessToken[]>([]);
  const [isTokensLoading, setIsTokensLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mealFilter, setMealFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');

  // Blocks for filter dropdown
  const [blocks, setBlocks] = useState<Block[]>([]);

  // SSE Live Connection Status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals
  const [selectedTokenDetail, setSelectedTokenDetail] = useState<ManagementMessTokenDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const [tokenToConsume, setTokenToConsume] = useState<ManagementMessToken | null>(null);
  const [isConsumeSubmitting, setIsConsumeSubmitting] = useState<boolean>(false);

  const [tokenToCancel, setTokenToCancel] = useState<ManagementMessToken | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState<boolean>(false);

  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [studentHistoryData, setStudentHistoryData] = useState<any | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Blocks
  const fetchBlocks = useCallback(async () => {
    try {
      const res = await managementApiService.getBlocks();
      setBlocks(res.blocks || []);
    } catch (err) {
      console.error('Failed to load blocks:', err);
    }
  }, []);

  // Fetch Overview Data
  const fetchOverview = useCallback(async (isBg = false) => {
    if (!isBg) setIsOverviewLoading(true);
    try {
      const res = await managementApiService.getMessOverview(selectedDate);
      if (res.success && res.data) {
        setOverview(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch mess overview:', err);
      showToast(err.message || 'Unable to load mess overview.', 'error');
    } finally {
      setIsOverviewLoading(false);
    }
  }, [selectedDate]);

  // Fetch Tokens List
  const fetchTokens = useCallback(async (pageToFetch = pagination.page, isBg = false) => {
    if (!isBg) setIsTokensLoading(true);
    try {
      const res = await managementApiService.getMessTokens({
        page: pageToFetch,
        limit: pagination.limit,
        date: selectedDate,
        mealType: mealFilter,
        status: statusFilter,
        block: blockFilter,
        search: searchTerm.trim() || undefined,
      });

      if (res.success) {
        setTokens(res.tokens || []);
        setPagination(res.pagination);
      }
    } catch (err: any) {
      console.error('Failed to fetch tokens:', err);
      showToast(err.message || 'Unable to load token bookings.', 'error');
    } finally {
      setIsTokensLoading(false);
    }
  }, [selectedDate, mealFilter, statusFilter, blockFilter, searchTerm, pagination.limit, pagination.page]);

  // Combined Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchOverview(true), fetchTokens(pagination.page, true)]);
    setIsRefreshing(false);
    showToast('Mess data refreshed from PostgreSQL');
  };

  // Initial Load
  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  useEffect(() => {
    fetchOverview();
    fetchTokens(1);
  }, [fetchOverview, fetchTokens]);

  // Real-time SSE synchronization
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        if (
          event?.type === 'MESS_TOKEN_BOOKED' ||
          event?.type === 'MESS_TOKEN_CONSUMED' ||
          event?.type === 'MESS_TOKEN_CANCELLED' ||
          event?.type === 'MESS_STATS_UPDATED'
        ) {
          fetchOverview(true);
          fetchTokens(pagination.page, true);
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, [fetchOverview, fetchTokens, pagination.page]);

  // Action: Open Token Detail
  const handleViewDetail = async (tokenId: string) => {
    try {
      const res = await managementApiService.getMessToken(tokenId);
      if (res.success && res.token) {
        setSelectedTokenDetail(res.token);
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load token details.', 'error');
    }
  };

  // Action: Consume Token
  const handleConfirmConsume = async () => {
    if (!tokenToConsume) return;
    setIsConsumeSubmitting(true);
    try {
      const res = await managementApiService.consumeMessToken(tokenToConsume.id);
      if (res.success) {
        showToast(res.message || 'Token marked as consumed.');
        setTokenToConsume(null);
        if (isDetailModalOpen && selectedTokenDetail?.id === tokenToConsume.id) {
          setSelectedTokenDetail({
            ...selectedTokenDetail,
            status: 'CONSUMED',
            consumedAt: new Date().toISOString(),
          });
        }
        await Promise.all([fetchOverview(true), fetchTokens(pagination.page, true)]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to mark token as consumed.', 'error');
    } finally {
      setIsConsumeSubmitting(false);
    }
  };

  // Action: Cancel Token
  const handleConfirmCancel = async () => {
    if (!tokenToCancel) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      setCancelError('Please provide a reason of at least 3 characters.');
      return;
    }
    setIsCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await managementApiService.cancelMessToken(tokenToCancel.id, cancelReason.trim());
      if (res.success) {
        showToast(res.message || 'Token cancelled successfully.');
        setTokenToCancel(null);
        setCancelReason('');
        if (isDetailModalOpen && selectedTokenDetail?.id === tokenToCancel.id) {
          setSelectedTokenDetail({
            ...selectedTokenDetail,
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString(),
            cancellationReason: cancelReason.trim(),
          });
        }
        await Promise.all([fetchOverview(true), fetchTokens(pagination.page, true)]);
      }
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel token.');
    } finally {
      setIsCancelSubmitting(false);
    }
  };

  // Action: Open Resident History
  const handleViewHistory = async (studentId: string) => {
    setHistoryStudentId(studentId);
    setIsHistoryLoading(true);
    try {
      const res = await managementApiService.getStudentMessHistory(studentId);
      if (res.success) {
        setStudentHistoryData(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load resident history.', 'error');
      setHistoryStudentId(null);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div className="mess-management-view">
      {/* Toast Notification */}
      {toast && (
        <div className={`block-toast toast-${toast.type}`} role="status">
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="toast-icon" />
          ) : (
            <AlertTriangle size={16} className="toast-icon" />
          )}
          <span>{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="mess-header-bar">
        <div className="mess-header-info">
          <div className="mess-header-tag">
            <UtensilsCrossed size={13} />
            <span>Hostel Dining Facility</span>
          </div>
          <h1 className="mess-page-title">Mess Management</h1>
          <p className="mess-page-desc">
            Real-time residential mess monitoring, token verification, and meal service analytics.
          </p>
        </div>

        {/* Date Selector & Controls */}
        <div className="mess-header-controls">
          <div className={`mess-live-indicator ${isLiveConnected ? 'connected' : 'connecting'}`}>
            <Radio size={14} className={isLiveConnected ? 'spin-anim' : ''} />
            <span>{isLiveConnected ? 'Live SSE Connected' : 'Syncing...'}</span>
          </div>

          <div className="mess-date-selector">
            <Calendar size={15} style={{ color: '#64748B' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mess-date-input"
              aria-label="Select mess date"
            />
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="mess-today-btn"
              >
                Today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="sync-btn"
            title="Refresh from PostgreSQL"
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="sync-btn-label">Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Meal Slot Live Banner */}
      {overview?.activeMealSlot && (
        <div className="mess-active-banner">
          <div className="mess-active-left">
            <div className="mess-active-icon-box">
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="mess-active-badge">Now Serving</span>
                <h3 className="mess-active-title">{overview.activeMealSlot.name}</h3>
              </div>
              <p className="mess-active-desc">
                Timing Window: <strong>{overview.activeMealSlot.timing}</strong> &mdash;{' '}
                {overview.activeMealSlot.description}
              </p>
            </div>
          </div>
          <div className="mess-active-right">
            <Clock size={14} />
            <span>Verification Counter Active</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="mess-stats-grid">
        {/* Total Bookings */}
        <div className="mess-stat-card">
          <div className="mess-stat-top">
            <span className="mess-stat-label">Total Bookings</span>
            <div className="mess-stat-icon-wrap navy">
              <UtensilsCrossed size={18} />
            </div>
          </div>
          <div className="mess-stat-value">
            {isOverviewLoading ? '...' : overview?.summary.totalBookings ?? 0}
          </div>
          <p className="mess-stat-subtext">
            <User size={13} />
            <span>{overview?.totalActiveResidents ?? 0} active allocated residents</span>
          </p>
        </div>

        {/* Consumed / Verified */}
        <div className="mess-stat-card">
          <div className="mess-stat-top">
            <span className="mess-stat-label">Verified / Consumed</span>
            <div className="mess-stat-icon-wrap emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mess-stat-value emerald">
            {isOverviewLoading ? '...' : overview?.summary.consumedCount ?? 0}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669', marginLeft: '6px' }}>
              ({overview?.summary.consumptionRate ?? 0}%)
            </span>
          </div>
          <div className="mess-progress-bar">
            <div
              className="mess-progress-fill"
              style={{ width: `${Math.min(100, overview?.summary.consumptionRate ?? 0)}%` }}
            />
          </div>
        </div>

        {/* Pending Booked */}
        <div className="mess-stat-card">
          <div className="mess-stat-top">
            <span className="mess-stat-label">Pending Bookings</span>
            <div className="mess-stat-icon-wrap blue">
              <Clock size={18} />
            </div>
          </div>
          <div className="mess-stat-value blue">
            {isOverviewLoading ? '...' : overview?.summary.bookedCount ?? 0}
          </div>
          <p className="mess-stat-subtext">Awaiting counter verification</p>
        </div>

        {/* Cancelled */}
        <div className="mess-stat-card">
          <div className="mess-stat-top">
            <span className="mess-stat-label">Cancelled Tokens</span>
            <div className="mess-stat-icon-wrap rose">
              <Ban size={18} />
            </div>
          </div>
          <div className="mess-stat-value rose">
            {isOverviewLoading ? '...' : overview?.summary.cancelledCount ?? 0}
          </div>
          <p className="mess-stat-subtext">Revoked / void records</p>
        </div>
      </div>

      {/* 4 Meal Cards Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <TrendingUp size={15} style={{ color: '#F59E0B' }} />
          <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: 0 }}>
            Meal-Wise Breakdown ({selectedDate})
          </h2>
        </div>
        <div className="mess-meals-grid">
          {overview?.mealBreakdown?.map((meal) => {
            const isActiveMeal = overview.activeMealSlot?.mealType === meal.mealType;
            return (
              <div key={meal.mealType} className={`mess-meal-card ${isActiveMeal ? 'active-slot' : ''}`}>
                <div className="mess-meal-top">
                  <div>
                    <h3 className="mess-meal-name">
                      {meal.name}
                      {isActiveMeal && <span className="mess-live-dot" title="Active Meal Slot" />}
                    </h3>
                    <p className="mess-meal-timing">{meal.timing}</p>
                  </div>
                  <span className="mess-meal-total">{meal.total}</span>
                </div>

                <div className="mess-meal-stat-chips">
                  <div>
                    <span className="mess-chip-label">Booked</span>
                    <span className="mess-chip-val blue">{meal.booked}</span>
                  </div>
                  <div>
                    <span className="mess-chip-label">Consumed</span>
                    <span className="mess-chip-val emerald">{meal.consumed}</span>
                  </div>
                  <div>
                    <span className="mess-chip-label">Cancelled</span>
                    <span className="mess-chip-val rose">{meal.cancelled}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mess-filter-card">
        <div className="mess-search-wrap">
          <Search size={15} className="mess-search-icon" />
          <input
            type="text"
            placeholder="Search by Token #, Student Name, or JNTU No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mess-search-input"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="mess-search-clear">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mess-dropdown-group">
          {/* Meal Filter */}
          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value)}
            className="mess-filter-select"
            aria-label="Filter by meal type"
          >
            <option value="ALL">All Meals</option>
            <option value="BREAKFAST">Breakfast</option>
            <option value="LUNCH">Lunch</option>
            <option value="SNACKS">Evening Snacks</option>
            <option value="DINNER">Dinner</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mess-filter-select"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="BOOKED">Booked (Pending)</option>
            <option value="CONSUMED">Consumed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Block Filter */}
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="mess-filter-select"
            aria-label="Filter by block"
          >
            <option value="ALL">All Blocks</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Reset Filters Button */}
          {(searchTerm || mealFilter !== 'ALL' || statusFilter !== 'ALL' || blockFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setMealFilter('ALL');
                setStatusFilter('ALL');
                setBlockFilter('ALL');
              }}
              className="mess-reset-btn"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Bookings / Tokens Table Card */}
      <div className="mess-table-card">
        <div className="mess-table-header">
          <h2 className="mess-table-title">
            <span>Resident Token Records</span>
            <span className="mess-badge-count">{pagination.total} total</span>
          </h2>
          <span style={{ fontSize: '0.775rem', color: '#64748B' }}>
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
        </div>

        <div className="mess-table-wrap">
          <table className="mess-table">
            <thead>
              <tr>
                <th>Token Number</th>
                <th>Resident</th>
                <th>Block / Room</th>
                <th>Meal Service</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isTokensLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748B' }}>
                    <RotateCw size={24} className="spin-anim" style={{ margin: '0 auto 0.5rem auto', color: '#F59E0B' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Loading tokens from PostgreSQL...</p>
                  </td>
                </tr>
              ) : tokens.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748B' }}>
                    <UtensilsCrossed size={32} style={{ margin: '0 auto 0.5rem auto', color: '#CBD5E1' }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>No token bookings found</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>Try adjusting date, meal, or search filters.</p>
                  </td>
                </tr>
              ) : (
                tokens.map((token) => (
                  <tr key={token.id}>
                    {/* Token Number */}
                    <td>
                      <span className="mess-token-badge">
                        {token.tokenNumber || token.id.substring(0, 8)}
                      </span>
                    </td>

                    {/* Resident Info */}
                    <td>
                      {token.student ? (
                        <div>
                          <span
                            className="mess-resident-name"
                            onClick={() => handleViewHistory(token.student!.id)}
                            title="Click to view full meal history"
                          >
                            {token.student.name}
                          </span>
                          <div className="mess-resident-roll">{token.student.jntuNo}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Unknown</span>
                      )}
                    </td>

                    {/* Block / Room */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                        <Building size={13} style={{ color: '#64748B' }} />
                        <span>{token.student?.blockName || 'Unassigned'} &mdash; Room {token.student?.roomNumber || 'N/A'}</span>
                      </div>
                      {token.student?.bedNumber && (
                        <div style={{ fontSize: '0.725rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                          {token.student.bedNumber}
                        </div>
                      )}
                    </td>

                    {/* Meal Service */}
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{token.mealName}</div>
                      <div style={{ fontSize: '0.725rem', color: '#64748B' }}>{token.mealTiming}</div>
                    </td>

                    {/* Date */}
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                        {token.date}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      {token.status === 'BOOKED' && (
                        <span className="mess-status-pill booked">
                          <Clock size={12} />
                          Booked
                        </span>
                      )}
                      {token.status === 'CONSUMED' && (
                        <span className="mess-status-pill consumed">
                          <Check size={12} />
                          Consumed
                        </span>
                      )}
                      {token.status === 'CANCELLED' && (
                        <span className="mess-status-pill cancelled">
                          <Ban size={12} />
                          Cancelled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="mess-action-group">
                        {/* View Detail */}
                        <button
                          type="button"
                          onClick={() => handleViewDetail(token.id)}
                          className="mess-icon-action-btn"
                          title="View Token Specification"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Consume (if booked) */}
                        {token.status === 'BOOKED' && (
                          <button
                            type="button"
                            onClick={() => setTokenToConsume(token)}
                            className="mess-icon-action-btn consume"
                            title="Mark as Consumed"
                          >
                            <Check size={15} />
                          </button>
                        )}

                        {/* Cancel (if booked) */}
                        {token.status === 'BOOKED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTokenToCancel(token);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            className="mess-icon-action-btn cancel"
                            title="Cancel Token"
                          >
                            <Ban size={15} />
                          </button>
                        )}

                        {/* History */}
                        {token.student && (
                          <button
                            type="button"
                            onClick={() => handleViewHistory(token.student!.id)}
                            className="mess-icon-action-btn"
                            title="Resident History"
                          >
                            <History size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="mess-pagination-bar">
            <div>
              Showing{' '}
              <strong style={{ color: '#0F172A' }}>
                {(pagination.page - 1) * pagination.limit + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong style={{ color: '#0F172A' }}>{pagination.total}</strong> records
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                disabled={pagination.page <= 1 || isTokensLoading}
                onClick={() => fetchTokens(pagination.page - 1)}
                className="mess-page-btn"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <span style={{ padding: '0 0.4rem', fontFamily: 'monospace', fontWeight: 600 }}>
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || isTokensLoading}
                onClick={() => fetchTokens(pagination.page + 1)}
                className="mess-page-btn"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Token Detail Specification */}
      {isDetailModalOpen && selectedTokenDetail && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="mgmt-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="mgmt-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UtensilsCrossed size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Token Specification</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>
                    {selectedTokenDetail.tokenNumber}
                  </p>
                </div>
              </div>
              <button type="button" className="mgmt-modal-close" onClick={() => setIsDetailModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mgmt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Resident info box */}
              <div className="mess-detail-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                      {selectedTokenDetail.student?.name || 'Unknown'}
                    </h4>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.775rem', fontFamily: 'monospace', color: '#64748B' }}>
                      {selectedTokenDetail.student?.jntuNo}
                    </p>
                  </div>
                  <span className="mess-status-pill booked" style={{ fontSize: '0.7rem' }}>
                    {selectedTokenDetail.student?.allocationStatus || 'ACTIVE'}
                  </span>
                </div>
                <div className="mess-detail-grid">
                  <div className="mess-detail-item">
                    <span className="mess-detail-item-label">Block</span>
                    <span className="mess-detail-item-value">{selectedTokenDetail.student?.blockName || 'N/A'}</span>
                  </div>
                  <div className="mess-detail-item">
                    <span className="mess-detail-item-label">Room / Bed</span>
                    <span className="mess-detail-item-value">
                      {selectedTokenDetail.student?.roomNumber || 'N/A'} ({selectedTokenDetail.student?.bedNumber || 'N/A'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Meal details */}
              <div className="mess-detail-grid" style={{ margin: 0 }}>
                <div className="mess-detail-card">
                  <span className="mess-detail-item-label">Meal Service</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', display: 'block', marginTop: '0.2rem' }}>
                    {selectedTokenDetail.mealName}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '0.2rem' }}>
                    {selectedTokenDetail.mealTiming}
                  </span>
                </div>

                <div className="mess-detail-card">
                  <span className="mess-detail-item-label">Service Date & Status</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', color: '#0F172A', display: 'block', marginTop: '0.2rem' }}>
                    {selectedTokenDetail.date}
                  </span>
                  <div style={{ marginTop: '0.35rem' }}>
                    {selectedTokenDetail.status === 'BOOKED' && <span className="mess-status-pill booked">BOOKED</span>}
                    {selectedTokenDetail.status === 'CONSUMED' && <span className="mess-status-pill consumed">CONSUMED</span>}
                    {selectedTokenDetail.status === 'CANCELLED' && <span className="mess-status-pill cancelled">CANCELLED</span>}
                  </div>
                </div>
              </div>

              {/* Timestamps & audit */}
              <div className="mess-detail-card" style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Booked At:</span>
                  <strong style={{ color: '#1E293B', fontFamily: 'monospace' }}>
                    {new Date(selectedTokenDetail.createdAt).toLocaleString()}
                  </strong>
                </div>
                {selectedTokenDetail.consumedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>Verified / Consumed:</span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {new Date(selectedTokenDetail.consumedAt).toLocaleString()}
                    </strong>
                  </div>
                )}
                {selectedTokenDetail.cancelledAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                    <span>Cancelled At:</span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {new Date(selectedTokenDetail.cancelledAt).toLocaleString()}
                    </strong>
                  </div>
                )}
                {selectedTokenDetail.cancellationReason && (
                  <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #E2E8F0', color: '#DC2626' }}>
                    <span style={{ fontWeight: 700 }}>Reason: </span>
                    <span style={{ fontStyle: 'italic' }}>"{selectedTokenDetail.cancellationReason}"</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mgmt-modal-footer">
              <button
                type="button"
                className="mgmt-btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>

              {selectedTokenDetail.status === 'BOOKED' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const t = tokens.find((tk) => tk.id === selectedTokenDetail.id);
                      if (t) setTokenToCancel(t);
                    }}
                    className="mgmt-btn-danger"
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                  >
                    Cancel Token
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const t = tokens.find((tk) => tk.id === selectedTokenDetail.id);
                      if (t) setTokenToConsume(t);
                    }}
                    className="mgmt-btn-primary"
                    style={{ background: '#059669', borderColor: '#059669' }}
                  >
                    Mark as Consumed
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirm Consume */}
      {tokenToConsume && (
        <div className="mgmt-modal-backdrop" onClick={() => setTokenToConsume(null)}>
          <div className="mgmt-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="mgmt-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Verify Meal Consumption</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>Confirm counter redemption</p>
                </div>
              </div>
              <button type="button" className="mgmt-modal-close" onClick={() => setTokenToConsume(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mgmt-modal-body">
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Mark token <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{tokenToConsume.tokenNumber}</strong> as consumed for resident <strong style={{ color: '#0F172A' }}>{tokenToConsume.student?.name}</strong>?
              </p>
              <div className="mess-detail-card" style={{ fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#64748B' }}>Meal Service:</span>
                  <strong>{tokenToConsume.mealName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Service Date:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{tokenToConsume.date}</strong>
                </div>
              </div>
            </div>

            <div className="mgmt-modal-footer">
              <button
                type="button"
                className="mgmt-btn-secondary"
                disabled={isConsumeSubmitting}
                onClick={() => setTokenToConsume(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mgmt-btn-primary"
                style={{ background: '#059669', borderColor: '#059669' }}
                disabled={isConsumeSubmitting}
                onClick={handleConfirmConsume}
              >
                {isConsumeSubmitting && <RotateCw size={14} className="spin-anim" />}
                <span>Confirm Consumption</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Cancel Token with Reason */}
      {tokenToCancel && (
        <div className="mgmt-modal-backdrop" onClick={() => setTokenToCancel(null)}>
          <div className="mgmt-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="mgmt-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Cancel Mess Token</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>Administrative cancellation</p>
                </div>
              </div>
              <button type="button" className="mgmt-modal-close" onClick={() => setTokenToCancel(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mgmt-modal-body">
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Are you sure you want to cancel token <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{tokenToCancel.tokenNumber}</strong> for resident <strong style={{ color: '#0F172A' }}>{tokenToCancel.student?.name}</strong>?
              </p>

              {cancelError && (
                <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  {cancelError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Cancellation Reason <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Resident on leave, emergency mess maintenance, duplicate requested..."
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }}
                />
                <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', marginTop: '0.3rem' }}>
                  This reason is recorded in the ActivityLog and notified to the student.
                </span>
              </div>
            </div>

            <div className="mgmt-modal-footer">
              <button
                type="button"
                className="mgmt-btn-secondary"
                disabled={isCancelSubmitting}
                onClick={() => setTokenToCancel(null)}
              >
                Go Back
              </button>
              <button
                type="button"
                className="mgmt-btn-danger"
                disabled={isCancelSubmitting}
                onClick={handleConfirmCancel}
              >
                {isCancelSubmitting && <RotateCw size={14} className="spin-anim" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Resident Mess History */}
      {historyStudentId && (
        <div className="mgmt-modal-backdrop" onClick={() => { setHistoryStudentId(null); setStudentHistoryData(null); }}>
          <div className="mgmt-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="mgmt-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Resident Mess History</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    {studentHistoryData?.student?.name} ({studentHistoryData?.student?.jntuNo})
                  </p>
                </div>
              </div>
              <button type="button" className="mgmt-modal-close" onClick={() => { setHistoryStudentId(null); setStudentHistoryData(null); }}>
                <X size={18} />
              </button>
            </div>

            <div className="mgmt-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem' }}>
              {isHistoryLoading ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748B' }}>
                  <RotateCw size={24} className="spin-anim" style={{ margin: '0 auto 0.5rem auto', color: '#F59E0B' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Loading resident history...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {studentHistoryData?.summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div className="mess-detail-card" style={{ padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.675rem', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Total</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0F172A' }}>{studentHistoryData.summary.totalBooked}</strong>
                      </div>
                      <div className="mess-detail-card" style={{ padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.675rem', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Booked</span>
                        <strong style={{ fontSize: '1.1rem', color: '#2563EB' }}>{studentHistoryData.summary.activeBooked}</strong>
                      </div>
                      <div className="mess-detail-card" style={{ padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.675rem', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Consumed</span>
                        <strong style={{ fontSize: '1.1rem', color: '#059669' }}>{studentHistoryData.summary.consumedCount}</strong>
                      </div>
                      <div className="mess-detail-card" style={{ padding: '0.5rem' }}>
                        <span style={{ fontSize: '0.675rem', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Cancelled</span>
                        <strong style={{ fontSize: '1.1rem', color: '#DC2626' }}>{studentHistoryData.summary.cancelledCount}</strong>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {studentHistoryData?.tokens?.map((tok: any) => (
                      <div key={tok.id} className="mess-detail-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>{tok.mealName}</strong>
                            <span className="mess-token-badge">{tok.tokenNumber}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                            {tok.date}
                          </div>
                          {tok.cancellationReason && (
                            <div style={{ fontSize: '0.725rem', color: '#DC2626', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              Reason: {tok.cancellationReason}
                            </div>
                          )}
                        </div>
                        <div>
                          {tok.status === 'BOOKED' && <span className="mess-status-pill booked">BOOKED</span>}
                          {tok.status === 'CONSUMED' && <span className="mess-status-pill consumed">CONSUMED</span>}
                          {tok.status === 'CANCELLED' && <span className="mess-status-pill cancelled">CANCELLED</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mgmt-modal-footer">
              <button
                type="button"
                className="mgmt-btn-secondary"
                onClick={() => { setHistoryStudentId(null); setStudentHistoryData(null); }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessManagementPage;
