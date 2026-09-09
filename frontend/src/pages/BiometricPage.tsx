import React, { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint,
  LogIn,
  LogOut,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  apiService,
  BiometricEventItem,
  BiometricTodayStatus,
  DailyAttendanceSummary,
} from '../services/api';

export const BiometricPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [todayStatus, setTodayStatus] = useState<BiometricTodayStatus | null>(null);
  const [events, setEvents] = useState<BiometricEventItem[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyAttendanceSummary[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'timeline' | 'daily'>('timeline');

  // Modal & Toast
  const [selectedEvent, setSelectedEvent] = useState<BiometricEventItem | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  useEffect(() => {
    if (realtimeToast) {
      const timer = setTimeout(() => setRealtimeToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [realtimeToast]);

  /**
   * Fetch authoritative overview and daily summaries
   */
  const fetchData = useCallback(
    async (isSilent = false) => {
      if (isSilent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [overviewRes, summaryRes] = await Promise.all([
          apiService.getBiometricOverview({
            page: pagination.page,
            limit: pagination.limit,
            dateRange,
            eventType: eventTypeFilter,
            verificationStatus: verificationFilter,
          }),
          apiService.getBiometricSummary(7),
        ]);

        setTodayStatus(overviewRes.today);
        setEvents(overviewRes.events);
        setPagination(overviewRes.pagination);
        setDailySummaries(summaryRes.dailySummaries);
      } catch (err: any) {
        console.error('Error fetching biometric data:', err);
        setError(err.message || 'Unable to load biometric records.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [pagination.page, pagination.limit, dateRange, eventTypeFilter, verificationFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Real-time SSE listener
   */
  useEffect(() => {
    const unsubscribe = apiService.subscribeToBiometricEvents((event) => {
      const typeLabel = event.eventType === 'ENTRY' ? 'Entry' : 'Exit';
      const gateLabel = event.gate || 'Gate';
      setRealtimeToast(`New Biometric ${typeLabel} recorded at ${gateLabel} (${event.status || 'Verified'})`);
      fetchData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatFullDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="biometric-page-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Alert */}
      {realtimeToast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '12px 20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.9rem',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <CheckCircle2 size={18} color="#10b981" />
          <span>{realtimeToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', padding: '8px', borderRadius: '10px' }}>
              <Fingerprint size={24} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: '#0f172a' }}>
              Biometric Tracking
            </h1>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
            Server-authoritative, real-time physical access logs from hostel turnstiles and security gates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={loading || isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#fff',
            color: '#334155',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: loading || isRefreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <RotateCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Today's Status Banner Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
          padding: '1.5rem',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '6px' }}>
              Today's Presence State
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {todayStatus?.status === 'INSIDE_HOSTEL' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  Present / Inside Hostel
                </span>
              )}

              {todayStatus?.status === 'OUTSIDE_HOSTEL' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                  Outside Hostel
                </span>
              )}

              {todayStatus?.status === 'NO_RECORD' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8', display: 'inline-block' }} />
                  No Record Today
                </span>
              )}

              {todayStatus?.latestEvent && (
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Last verified {todayStatus.latestEvent.eventType === 'ENTRY' ? 'entry' : 'exit'} at{' '}
                  <strong>{formatTime(todayStatus.latestEvent.eventTimestamp)}</strong> via {todayStatus.latestEvent.gate || 'Main Gate'}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.85rem', fontWeight: 500 }}>
            <ShieldCheck size={16} />
            <span>Immutable Device Log</span>
          </div>
        </div>

        {/* 5-Column Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '1rem',
          }}
        >
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogIn size={15} color="#10b981" />
              <span>First Entry</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {todayStatus?.firstEntry ? formatTime(todayStatus.firstEntry.toString()) : '--:--'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogOut size={15} color="#f59e0b" />
              <span>Last Exit</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {todayStatus?.lastExit ? formatTime(todayStatus.lastExit.toString()) : '--:--'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <Fingerprint size={15} color="#3b82f6" />
              <span>Entries Today</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {todayStatus?.entryCount ?? 0}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogOut size={15} color="#8b5cf6" />
              <span>Exits Today</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {todayStatus?.exitCount ?? 0}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <Clock size={15} color="#059669" />
              <span>Time Inside Today</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {todayStatus?.approximateHoursInside ? `${todayStatus.approximateHoursInside} hrs` : '0 hrs'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'timeline' ? '#fff' : 'transparent',
              color: activeTab === 'timeline' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'timeline' ? 600 : 500,
              boxShadow: activeTab === 'timeline' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Recent Activity & Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'daily' ? '#fff' : 'transparent',
              color: activeTab === 'daily' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'daily' ? 600 : 500,
              boxShadow: activeTab === 'daily' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Daily Attendance Summary
          </button>
        </div>

        {/* Filter Controls (Timeline Tab Only) */}
        {activeTab === 'timeline' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Events</option>
              <option value="ENTRY">Entries Only</option>
              <option value="EXIT">Exits Only</option>
            </select>

            {/* Verification Status */}
            <select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Results</option>
              <option value="VERIFIED">Verified Scans</option>
              <option value="REJECTED">Rejected Attempts</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: Timeline & Event List */}
      {activeTab === 'timeline' && (
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '75px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '10px',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div
              style={{
                backgroundColor: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}
            >
              <Fingerprint size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', margin: '0 0 6px 0' }}>
                No Biometric Records Found
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                No entry or exit events were recorded for the selected filter criteria.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map((ev) => {
                const isEntry = ev.eventType === 'ENTRY';
                const isVerified = ev.verificationStatus === 'VERIFIED';

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Left: Direction Icon + Event Title & Gate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: !isVerified
                            ? '#fef2f2'
                            : isEntry
                            ? '#ecfdf5'
                            : '#eff6ff',
                          color: !isVerified
                            ? '#ef4444'
                            : isEntry
                            ? '#10b981'
                            : '#3b82f6',
                        }}
                      >
                        {!isVerified ? (
                          <XCircle size={22} />
                        ) : isEntry ? (
                          <LogIn size={22} />
                        ) : (
                          <LogOut size={22} />
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                            {isEntry ? 'Hostel Gate Entry' : 'Hostel Gate Exit'}
                          </span>

                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: isVerified ? '#ecfdf5' : '#fef2f2',
                              color: isVerified ? '#065f46' : '#991b1b',
                            }}
                          >
                            {isVerified ? 'VERIFIED' : 'REJECTED'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={13} />
                            {ev.gate || 'Main Gate'}
                          </span>
                          <span>•</span>
                          <span>{ev.deviceLabel || ev.deviceId || 'Turnstile Device'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                          {formatTime(ev.eventTimestamp)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {formatDate(ev.eventTimestamp)}
                        </div>
                      </div>

                      <ChevronRight size={18} color="#94a3b8" />
                    </div>
                  </div>
                );
              })}

              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    marginTop: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                        color: pagination.page <= 1 ? '#94a3b8' : '#334155',
                        fontSize: '0.85rem',
                      }}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                        color: pagination.page >= pagination.totalPages ? '#94a3b8' : '#334155',
                        fontSize: '0.85rem',
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Daily Attendance Summary */}
      {activeTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dailySummaries.map((day) => {
            const isInside = day.status === 'INSIDE_HOSTEL';
            const hasRecord = day.status !== 'NO_RECORD';

            return (
              <div
                key={day.date}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Calendar size={18} color="#6366f1" />
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>
                      {formatDate(day.date)}
                    </span>

                    {hasRecord ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: isInside ? '#ecfdf5' : '#fffbeb',
                          color: isInside ? '#065f46' : '#92400e',
                        }}
                      >
                        {isInside ? 'INSIDE HOSTEL' : 'OUTSIDE'}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                        }}
                      >
                        NO SCANS
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>First In: <strong>{formatTime(day.firstEntry)}</strong></span>
                    <span>•</span>
                    <span>Last Out: <strong>{formatTime(day.lastExit)}</strong></span>
                    <span>•</span>
                    <span>Total Scans: <strong>{day.totalEvents}</strong></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>
                    Hours Inside Hostel
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    {day.approximateHoursInside} hrs
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAILS MODAL */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedEvent(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: selectedEvent.verificationStatus === 'VERIFIED' ? '#f8fafc' : '#fef2f2',
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Fingerprint size={22} color={selectedEvent.verificationStatus === 'VERIFIED' ? '#3b82f6' : '#ef4444'} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Biometric Scan Details
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: '1',
                  color: '#64748b',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Scan Result</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: selectedEvent.verificationStatus === 'VERIFIED' ? '#065f46' : '#991b1b',
                  }}
                >
                  {selectedEvent.verificationStatus === 'VERIFIED' ? (
                    <>
                      <CheckCircle2 size={16} /> VERIFIED SUCCESSFUL
                    </>
                  ) : (
                    <>
                      <XCircle size={16} /> REJECTED / ACCESS DENIED
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Event Type & Direction</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.eventType} ({selectedEvent.direction === 'IN' ? 'Inward Ingress' : 'Outward Egress'})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Date & Timestamp</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {formatFullDateTime(selectedEvent.eventTimestamp)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Gate Location</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.gate || 'Main Gate'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Device / Scanner</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.deviceLabel || selectedEvent.deviceId || 'Turnstile Scanner #1'}
                </span>
              </div>

              {selectedEvent.rejectionReason && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>Rejection Reason</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#b91c1c' }}>
                    {selectedEvent.rejectionReason}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Verification Source</span>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {selectedEvent.source || 'PHYSICAL_BIOMETRIC_DEVICE'}
                </span>
              </div>

              {/* Security & Privacy Notice */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.78rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  This is an immutable physical gate scan logged by the server. Raw biometric patterns and templates are never retained or transmitted.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
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
